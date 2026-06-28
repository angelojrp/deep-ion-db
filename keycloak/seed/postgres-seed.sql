-- Seed de dados para PostgreSQL de teste (deep-ion-db)
-- Banco: testdb / Usuário: testuser

CREATE TABLE IF NOT EXISTS clientes (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(120) NOT NULL,
  email     VARCHAR(200) UNIQUE NOT NULL,
  pais      VARCHAR(60)  NOT NULL DEFAULT 'Brasil',
  criado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produtos (
  id         SERIAL PRIMARY KEY,
  nome       VARCHAR(120)    NOT NULL,
  categoria  VARCHAR(60)     NOT NULL,
  preco      NUMERIC(10, 2)  NOT NULL,
  estoque    INTEGER         NOT NULL DEFAULT 0,
  criado_em  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos (
  id           SERIAL PRIMARY KEY,
  cliente_id   INTEGER        NOT NULL REFERENCES clientes(id),
  status       VARCHAR(30)    NOT NULL DEFAULT 'pendente',
  total        NUMERIC(12, 2) NOT NULL,
  criado_em    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  entregue_em  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id          SERIAL PRIMARY KEY,
  pedido_id   INTEGER        NOT NULL REFERENCES pedidos(id),
  produto_id  INTEGER        NOT NULL REFERENCES produtos(id),
  quantidade  INTEGER        NOT NULL,
  preco_unit  NUMERIC(10, 2) NOT NULL
);

-- Clientes
INSERT INTO clientes (nome, email, pais) VALUES
  ('Ana Silva',      'ana.silva@exemplo.com',    'Brasil'),
  ('Bruno Costa',    'bruno.costa@exemplo.com',  'Brasil'),
  ('Carla Mendes',   'carla.m@exemplo.com',      'Portugal'),
  ('Diego Torres',   'diego.t@exemplo.com',      'Argentina'),
  ('Elena Oliveira', 'elena.o@exemplo.com',      'Brasil')
ON CONFLICT DO NOTHING;

-- Produtos
INSERT INTO produtos (nome, categoria, preco, estoque) VALUES
  ('Notebook Pro 15',      'Eletrônicos',  4599.90, 42),
  ('Mouse Ergonômico',     'Periféricos',    89.90, 310),
  ('Teclado Mecânico RGB', 'Periféricos',   299.90, 155),
  ('Monitor 27" 4K',       'Eletrônicos', 1899.00,  28),
  ('Cadeira Gamer',        'Móveis',       999.00,  17),
  ('Headset USB',          'Áudio',        249.90,  88),
  ('Webcam Full HD',       'Periféricos',  179.90,  64),
  ('SSD NVMe 1TB',         'Armazenamento', 389.90, 200)
ON CONFLICT DO NOTHING;

-- Pedidos
INSERT INTO pedidos (cliente_id, status, total, criado_em, entregue_em) VALUES
  (1, 'entregue',  4689.80, NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days'),
  (2, 'entregue',   389.80, NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 days'),
  (3, 'enviado',   1899.00, NOW() - INTERVAL '3 days',  NULL),
  (4, 'pendente',  1248.90, NOW() - INTERVAL '1 day',   NULL),
  (1, 'processando', 249.90, NOW() - INTERVAL '6 hours', NULL);

-- Itens
INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unit) VALUES
  (1, 1, 1, 4599.90),
  (1, 2, 1,   89.90),
  (2, 3, 1,  299.90),
  (2, 2, 1,   89.90),
  (3, 4, 1, 1899.00),
  (4, 5, 1,  999.00),
  (4, 6, 1,  249.90),
  (5, 6, 1,  249.90);

-- View útil para testes
CREATE OR REPLACE VIEW vw_pedidos_detalhado AS
SELECT
  p.id          AS pedido_id,
  c.nome        AS cliente,
  p.status,
  p.total,
  p.criado_em,
  COUNT(ip.id)  AS qtd_itens
FROM pedidos p
JOIN clientes c      ON c.id = p.cliente_id
JOIN itens_pedido ip ON ip.pedido_id = p.id
GROUP BY p.id, c.nome, p.status, p.total, p.criado_em;
