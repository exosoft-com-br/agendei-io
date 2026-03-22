import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as fs from "fs";
import * as path from "path";
import { supabase } from "../supabaseClient";

// Versão conhecida como fallback se fetchLatestBaileysVersion() falhar/timeout
const WA_VERSION_FALLBACK: [number, number, number] = [2, 3000, 1015901307];

async function resolverVersaoWA(): Promise<[number, number, number]> {
  try {
    const { version } = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8_000)),
    ]);
    console.log(`[baileys] Versão WA obtida: ${version}`);
    return version;
  } catch {
    console.warn(`[baileys] fetchLatestBaileysVersion falhou — usando fallback ${WA_VERSION_FALLBACK}`);
    return WA_VERSION_FALLBACK;
  }
}

type WStatus = "desconectado" | "conectando" | "conectado";

interface WInstance {
  socket: ReturnType<typeof makeWASocket> | null;
  qr: string | null;
  status: WStatus;
  reconnectAttempts: number;
}

class BaileysManager {
  private instances = new Map<string, WInstance>();
  // WA_SESSIONS_PATH pode apontar para um disco persistente no Render (plano pago)
  // Se não definido, usa /tmp (sessões perdidas no restart)
  private readonly sessionsDir = process.env.WA_SESSIONS_PATH || "/tmp/wa-sessions";

  constructor() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Salva snapshot dos arquivos de sessão no Supabase (backup contra restart).
   * Chamado após conexão bem-sucedida.
   */
  private async backupSessaoSupabase(negocioId: string): Promise<void> {
    try {
      const sessionDir = path.join(this.sessionsDir, negocioId);
      if (!fs.existsSync(sessionDir)) return;
      const arquivos: Record<string, string> = {};
      for (const file of fs.readdirSync(sessionDir)) {
        const filePath = path.join(sessionDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          arquivos[file] = fs.readFileSync(filePath, "utf8");
        }
      }
      if (!Object.keys(arquivos).length) return;
      await supabase.from("whatsapp_sessions").upsert(
        { negocio_id: negocioId, arquivos, atualizado_em: new Date().toISOString() },
        { onConflict: "negocio_id" }
      );
    } catch (e) {
      console.warn("[baileys] Falha ao fazer backup no Supabase:", e);
    }
  }

  /**
   * Restaura arquivos de sessão do Supabase para o disco local.
   * Chamado no startup antes de tentar reconectar.
   */
  private async restaurarSessaoSupabase(negocioId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from("whatsapp_sessions")
        .select("arquivos")
        .eq("negocio_id", negocioId)
        .single();
      if (!data?.arquivos) return false;
      const sessionDir = path.join(this.sessionsDir, negocioId);
      fs.mkdirSync(sessionDir, { recursive: true });
      for (const [file, content] of Object.entries(data.arquivos as Record<string, string>)) {
        fs.writeFileSync(path.join(sessionDir, file), content, "utf8");
      }
      console.log(`[baileys] Sessão restaurada do Supabase para ${negocioId}`);
      return true;
    } catch {
      return false;
    }
  }

  getStatus(negocioId: string): WStatus {
    return this.instances.get(negocioId)?.status ?? "desconectado";
  }

  getQR(negocioId: string): string | null {
    return this.instances.get(negocioId)?.qr ?? null;
  }

  /**
   * Reconecta automaticamente todos os negócios que tinham status "conectado" no banco.
   * Chamado no startup do servidor para restaurar sessões persistidas em /tmp.
   */
  async reconectarSessoesPersistidas(): Promise<void> {
    try {
      const { data: negocios } = await supabase
        .from("negocios")
        .select("id")
        .eq("whatsapp_status", "conectado");

      if (!negocios?.length) return;

      for (const n of negocios) {
        const sessionDir = path.join(this.sessionsDir, n.id);
        const sessionDir = path.join(this.sessionsDir, n.id);
        const temLocal = fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;

        if (temLocal) {
          console.log(`[baileys] Restaurando sessão local do negócio ${n.id}...`);
          this.connect(n.id).catch((e) =>
            console.error(`[baileys] Falha ao restaurar ${n.id}:`, e)
          );
        } else {
          // Tenta restaurar do backup no Supabase (útil após restart no Render free tier)
          const restaurado = await this.restaurarSessaoSupabase(n.id);
          if (restaurado) {
            console.log(`[baileys] Reconectando ${n.id} com sessão restaurada do Supabase...`);
            this.connect(n.id).catch((e) =>
              console.error(`[baileys] Falha ao reconectar ${n.id} via backup:`, e)
            );
          } else {
            // Nenhuma sessão disponível — marca como desconectado
            await this.updateStatus(n.id, "desconectado");
          }
        }
      }
    } catch (e) {
      console.error("[baileys] Erro ao restaurar sessões:", e);
    }
  }

  async connect(negocioId: string): Promise<void> {
    const existing = this.instances.get(negocioId);
    if (existing?.status === "conectado") return;

    // Fecha socket existente sem travar
    try { existing?.socket?.end(undefined); } catch {}

    const sessionDir = path.join(this.sessionsDir, negocioId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const instance: WInstance = {
      socket: null,
      qr: null,
      status: "conectando",
      reconnectAttempts: (existing?.reconnectAttempts ?? 0),
    };
    this.instances.set(negocioId, instance);
    await this.updateStatus(negocioId, "conectando");

    let state: any, saveCreds: any;
    try {
      ({ state, saveCreds } = await useMultiFileAuthState(sessionDir));
    } catch (e) {
      console.error(`[baileys] Erro ao carregar estado de sessão de ${negocioId}:`, e);
      instance.status = "desconectado";
      await this.updateStatus(negocioId, "desconectado");
      return;
    }

    const version = await resolverVersaoWA();

    let socket: ReturnType<typeof makeWASocket>;
    try {
      socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ["Chrome (Linux)", "", ""],
        connectTimeoutMs: 30_000,
        defaultQueryTimeoutMs: 30_000,
        keepAliveIntervalMs: 20_000,
        retryRequestDelayMs: 2_000,
        maxMsgRetryCount: 3,
      });
    } catch (e) {
      console.error(`[baileys] Erro ao criar socket para ${negocioId}:`, e);
      instance.status = "desconectado";
      await this.updateStatus(negocioId, "desconectado");
      return;
    }

    instance.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log(`[baileys] QR gerado para ${negocioId}`);
        instance.qr = qr;
        instance.status = "conectando";
        instance.reconnectAttempts = 0; // reset ao gerar novo QR
      }

      if (connection === "close") {
        const boom = lastDisconnect?.error as Boom | undefined;
        const code  = boom?.output?.statusCode;
        const reason = boom?.message || "desconhecido";
        const loggedOut = code === DisconnectReason.loggedOut;

        console.warn(`[baileys] Conexão fechada para ${negocioId} — código: ${code} (${reason})`);

        instance.status = "desconectado";
        instance.qr     = null;
        instance.socket  = null;
        await this.updateStatus(negocioId, "desconectado");

        if (!loggedOut && instance.reconnectAttempts < 5) {
          instance.reconnectAttempts++;
          const delay = Math.min(5_000 * instance.reconnectAttempts, 30_000);
          console.log(`[baileys] Tentativa ${instance.reconnectAttempts}/5 em ${delay}ms para ${negocioId}`);
          setTimeout(() => this.connect(negocioId).catch(console.error), delay);
        } else if (loggedOut) {
          // Remove sessão local após logout
          const sessionDir = path.join(this.sessionsDir, negocioId);
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          }
        }
      }

      if (connection === "open") {
        instance.status = "conectado";
        instance.qr     = null;
        instance.reconnectAttempts = 0;
        await this.updateStatus(negocioId, "conectado");
        console.log(`[baileys] ✅ Negócio ${negocioId} conectado ao WhatsApp`);
        // Faz backup da sessão no Supabase para sobreviver a restarts
        setTimeout(() => this.backupSessaoSupabase(negocioId).catch(() => {}), 3_000);
      }
    });
  }

  async disconnect(negocioId: string): Promise<void> {
    const inst = this.instances.get(negocioId);
    if (inst?.socket) {
      try { await inst.socket.logout(); } catch {}
      try { inst.socket.end(undefined); } catch {}
    }
    this.instances.delete(negocioId);
    const sessionDir = path.join(this.sessionsDir, negocioId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    // Remove backup do Supabase
    await supabase.from("whatsapp_sessions").delete().eq("negocio_id", negocioId).catch(() => {});
    await this.updateStatus(negocioId, "desconectado");
  }

  async sendText(negocioId: string, phone: string, text: string): Promise<void> {
    const inst = this.instances.get(negocioId);
    if (!inst?.socket || inst.status !== "conectado") {
      throw new Error("WhatsApp não conectado para este negócio");
    }
    const jid = await this.resolverJid(inst.socket, phone);
    if (!jid) {
      console.warn(`[baileys] Número ${phone} não encontrado no WhatsApp — mensagem não enviada`);
      return;
    }
    await inst.socket.sendMessage(jid, { text });
  }

  /**
   * Resolve o JID correto para um número brasileiro.
   * Tenta com o número como informado; se não encontrar e for mobile BR com 9 dígitos,
   * tenta sem o nono dígito (compatibilidade com números antigos).
   */
  private async resolverJid(
    socket: ReturnType<typeof makeWASocket>,
    phone: string
  ): Promise<string | null> {
    const digits = phone.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;

    // Tenta o número principal
    try {
      const results = await socket.onWhatsApp(`${number}@s.whatsapp.net`);
      const result = results?.[0];
      if (result?.exists) return result.jid;
    } catch { /* continua */ }

    // Para números BR com 13 dígitos (55 + DDD + 9 + 8 dígitos),
    // tenta sem o nono dígito → 12 dígitos
    if (number.startsWith("55") && number.length === 13) {
      const semNono = number.slice(0, 4) + number.slice(5); // remove 5º dígito (o "9")
      try {
        const results = await socket.onWhatsApp(`${semNono}@s.whatsapp.net`);
        const result = results?.[0];
        if (result?.exists) {
          console.log(`[baileys] Usando JID sem nono dígito: ${semNono}`);
          return result.jid;
        }
      } catch { /* continua */ }
    }

    // Fallback: envia direto sem verificação
    console.warn(`[baileys] onWhatsApp não confirmou ${number} — tentando enviar assim mesmo`);
    return `${number}@s.whatsapp.net`;
  }

  private async updateStatus(negocioId: string, status: string): Promise<void> {
    try {
      await supabase.from("negocios").update({ whatsapp_status: status }).eq("id", negocioId);
    } catch (e) {
      console.error("[baileys] Erro ao atualizar status no banco:", e);
    }
  }
}

export const baileysManager = new BaileysManager();
