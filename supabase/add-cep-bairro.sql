-- Adicionar campo bairro na tabela negocios
-- (CEP é usado apenas para busca de endereço via ViaCEP, não é salvo no banco)
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS bairro VARCHAR(200);
