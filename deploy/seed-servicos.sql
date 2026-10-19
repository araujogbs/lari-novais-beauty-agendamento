-- Serviços do Atendimento Social (os mesmos do site). Rodar uma vez no banco novo:
--   docker compose exec -T db psql -U agendamento -d agendamento_db < seed-servicos.sql
-- Pode rodar de novo sem duplicar: só insere o que ainda não existe.
INSERT INTO "Services" ("Name", "DurationMinutes", "Price", "IsActive")
SELECT v.name, v.duration, v.price, TRUE
FROM (VALUES
    ('Maquiagem', 60, 350.00),
    ('Penteado', 90, 350.00),
    ('Maquiagem + Penteado', 150, 700.00),
    ('Escova e Babyliss', 60, 300.00)
) AS v(name, duration, price)
WHERE NOT EXISTS (SELECT 1 FROM "Services" s WHERE s."Name" = v.name);
