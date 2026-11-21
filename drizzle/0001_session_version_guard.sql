-- Controle de versão da mesa. É o primeiro comando de cada gravação (um batch = uma transação):
-- sobe a versão só se ninguém gravou desde a leitura; se gravou, o erro desfaz o batch inteiro
-- e o app relê a mesa e tenta de novo.
CREATE OR REPLACE FUNCTION pede_ai_bump_session_version(p_session_id text, p_expected integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE table_sessions SET version = version + 1 WHERE id = p_session_id AND version = p_expected;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pede_ai_conflict' USING ERRCODE = '40001';
  END IF;
END;
$$;
