-- Seed de dados para MySQL de teste (deep-ion-db)
-- Banco: testdb / Usuário: testuser

CREATE TABLE IF NOT EXISTS funcionarios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(200) NOT NULL UNIQUE,
  departamento VARCHAR(80) NOT NULL,
  cargo       VARCHAR(80)  NOT NULL,
  salario     DECIMAL(10,2) NOT NULL,
  admissao    DATE         NOT NULL,
  ativo       TINYINT(1)   NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS departamentos (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  nome    VARCHAR(80) NOT NULL UNIQUE,
  centro  VARCHAR(60) NOT NULL,
  budget  DECIMAL(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projetos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nome         VARCHAR(120) NOT NULL,
  descricao    TEXT,
  status       ENUM('planejamento','em_andamento','concluido','cancelado') NOT NULL DEFAULT 'planejamento',
  inicio       DATE NOT NULL,
  fim_previsto DATE,
  fim_real     DATE,
  departamento_id INT REFERENCES departamentos(id)
);

CREATE TABLE IF NOT EXISTS alocacoes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  funcionario_id INT NOT NULL REFERENCES funcionarios(id),
  projeto_id   INT NOT NULL REFERENCES projetos(id),
  papel        VARCHAR(60) NOT NULL DEFAULT 'desenvolvedor',
  horas        DECIMAL(6,1) NOT NULL DEFAULT 0
);

-- Departamentos
INSERT IGNORE INTO departamentos (nome, centro, budget) VALUES
  ('Engenharia',  'TI',       850000.00),
  ('Produto',     'TI',       420000.00),
  ('Dados',       'TI',       380000.00),
  ('Financeiro',  'Gestão',   210000.00),
  ('RH',          'Gestão',   180000.00);

-- Funcionários
INSERT IGNORE INTO funcionarios (nome, email, departamento, cargo, salario, admissao) VALUES
  ('Lucas Ferreira',  'lucas.f@empresa.com',   'Engenharia', 'Engenheiro Senior',   12500.00, '2020-03-15'),
  ('Mariana Santos',  'mariana.s@empresa.com', 'Produto',    'Product Manager',     14000.00, '2019-07-01'),
  ('Rafael Lima',     'rafael.l@empresa.com',  'Dados',      'Analista de Dados',    9800.00, '2021-01-10'),
  ('Julia Alves',     'julia.a@empresa.com',   'Engenharia', 'Desenvolvedora Full', 11200.00, '2021-06-20'),
  ('Pedro Rocha',     'pedro.r@empresa.com',   'Dados',      'Cientista de Dados',  13400.00, '2018-11-05'),
  ('Isabela Nunes',   'isabela.n@empresa.com', 'Financeiro', 'Analista Financeira',  8900.00, '2022-02-14'),
  ('Thiago Carvalho', 'thiago.c@empresa.com',  'RH',         'Gestor de RH',        10500.00, '2020-09-01'),
  ('Fernanda Cruz',   'fernanda.c@empresa.com','Engenharia', 'DevOps Engineer',     12000.00, '2022-05-03');

-- Projetos
INSERT IGNORE INTO projetos (nome, descricao, status, inicio, fim_previsto, departamento_id) VALUES
  ('Migração Cloud',       'Migrar infra on-prem para AWS',       'em_andamento', '2024-01-15', '2024-12-31', 1),
  ('Data Lake v2',         'Rebuild do lake com Apache Iceberg',  'planejamento', '2024-07-01', '2025-06-30', 3),
  ('Portal do Cliente',    'Nova experiência web para clientes',  'em_andamento', '2024-03-01', '2024-10-31', 2),
  ('Automação Folha',      'Automatizar processamento de folha',  'concluido',    '2023-06-01', '2023-12-31', 5),
  ('API Gateway Unificada','Gateway único para todos os serviços','planejamento', '2024-09-01', '2025-03-31', 1);

-- Alocações
INSERT IGNORE INTO alocacoes (funcionario_id, projeto_id, papel, horas) VALUES
  (1, 1, 'tech lead',       320.0),
  (4, 1, 'desenvolvedor',   280.0),
  (8, 1, 'devops',          200.0),
  (3, 2, 'engenheiro dados',180.0),
  (5, 2, 'arquiteto dados', 240.0),
  (2, 3, 'product owner',   160.0),
  (4, 3, 'desenvolvedora',  220.0),
  (7, 4, 'analista',         80.0),
  (6, 4, 'financeiro',       60.0),
  (1, 5, 'arquiteto',       120.0),
  (8, 5, 'devops',           90.0);
