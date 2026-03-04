-- ============================================================
-- Seed: Dados de teste (mesmos do Firebase)
-- ============================================================

-- NICHO: Barbearia
INSERT INTO nichos (id, nome_publico, tipo_cliente, saudacao_inicial, texto_confirmacao, termos) VALUES
('barbearia', 'Barbearia do João', 'cliente',
 '✂️ Olá! Bem-vindo à Barbearia do João! Vou te ajudar a agendar seu horário. Como posso te chamar?',
 'Agendamento confirmado! Seu protocolo é {protocolo}. Te esperamos em {dataHora}!',
 '{"servico": "serviço", "prestador": "barbeiro"}'
);

-- NICHO: Clínica
INSERT INTO nichos (id, nome_publico, tipo_cliente, saudacao_inicial, texto_confirmacao, termos) VALUES
('clinica', 'Clínica Saúde Total', 'paciente',
 '🏥 Olá! Bem-vindo à Clínica Saúde Total. Vou te ajudar a agendar sua consulta. Qual seu nome?',
 'Consulta agendada! Protocolo: {protocolo}. Data: {dataHora}. Chegue 15 min antes.',
 '{"servico": "consulta", "prestador": "médico"}'
);

-- PRESTADORES
INSERT INTO prestadores (id, nicho_id, nome, categoria, horario_inicio, horario_fim, dias_semana) VALUES
('barbeiro-pedro', 'barbearia', 'Barbeiro Pedro', 'Corte Masculino', '09:00', '19:00', '{1,2,3,4,5,6}'),
('dra-maria', 'clinica', 'Dra. Maria Santos', 'Clínico Geral', '08:00', '17:00', '{1,2,3,4,5}');

-- SERVICOS
INSERT INTO servicos (id, nicho_id, prestador_id, nome, duracao_minutos, preco) VALUES
('corte-simples', 'barbearia', 'barbeiro-pedro', 'Corte Simples', 30, 35.00),
('corte-barba', 'barbearia', 'barbeiro-pedro', 'Corte + Barba', 45, 55.00),
('consulta-geral', 'clinica', 'dra-maria', 'Consulta Geral', 30, 150.00);
