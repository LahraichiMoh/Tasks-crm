-- =============================================
-- CRM SAAS - SUPABASE SCHEMA
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

-- User roles enum
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'VIEWER');

-- Lead status enum
CREATE TYPE lead_status AS ENUM ('NEW', 'NO_ANSWER', 'PHONE_OFF', 'NOT_INTERESTED', 'INTERESTED');

-- Gender enum
CREATE TYPE gender_type AS ENUM ('MALE', 'FEMALE');

-- Activity action enum
CREATE TYPE activity_action AS ENUM (
  'LOGIN',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'LEAD_CREATED',
  'LEAD_UPDATED',
  'LEAD_STATUS_UPDATED',
  'LEAD_DELETED',
  'LEAD_ASSIGNED',
  'MESSAGE_SENT'
);

-- Entity type enum
CREATE TYPE entity_type AS ENUM ('USER', 'LEAD', 'MESSAGE');

-- =============================================
-- TABLES
-- =============================================

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'EMPLOYEE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  city VARCHAR(100),
  age INTEGER,
  gender gender_type DEFAULT 'MALE',
  status lead_status DEFAULT 'NEW',
  notes TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  is_broadcast BOOLEAN DEFAULT FALSE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action activity_action NOT NULL,
  description TEXT,
  entity_type entity_type,
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Leads indexes
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_created_by ON leads(created_by);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_gender ON leads(gender);

-- Messages indexes
CREATE INDEX idx_messages_from_id ON messages(from_id);
CREATE INDEX idx_messages_to_id ON messages(to_id);
CREATE INDEX idx_messages_is_broadcast ON messages(is_broadcast);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Activities indexes
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_entity_type ON activities(entity_type);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Users updated_at trigger
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Leads updated_at trigger
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VIEWS
-- =============================================

-- Leads with user names view
CREATE VIEW leads_with_users AS
SELECT 
  l.*,
  assigned.name AS assigned_to_name,
  creator.name AS created_by_name,
  updater.name AS updated_by_name
FROM leads l
LEFT JOIN users assigned ON l.assigned_to = assigned.id
LEFT JOIN users creator ON l.created_by = creator.id
LEFT JOIN users updater ON l.updated_by = updater.id;

-- Messages with user names view
CREATE VIEW messages_with_users AS
SELECT 
  m.*,
  sender.name AS from_name,
  CASE 
    WHEN m.is_broadcast THEN 'All Users'
    ELSE receiver.name
  END AS to_name
FROM messages m
LEFT JOIN users sender ON m.from_id = sender.id
LEFT JOIN users receiver ON m.to_id = receiver.id;

-- Activities with user names view
CREATE VIEW activities_with_users AS
SELECT 
  a.*,
  u.name AS user_name
FROM activities a
LEFT JOIN users u ON a.user_id = u.id;

-- Dashboard stats view
CREATE VIEW dashboard_stats AS
SELECT
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE status = 'INTERESTED') AS interested,
  COUNT(*) FILTER (WHERE status = 'NOT_INTERESTED') AS not_interested,
  COUNT(*) FILTER (WHERE status = 'NO_ANSWER') AS no_answer,
  COUNT(*) FILTER (WHERE status = 'PHONE_OFF') AS phone_off,
  COUNT(*) FILTER (WHERE status = 'NEW') AS new_leads,
  COUNT(*) FILTER (WHERE gender = 'MALE') AS male,
  COUNT(*) FILTER (WHERE gender = 'FEMALE') AS female,
  CASE 
    WHEN COUNT(*) > 0 
    THEN ROUND((COUNT(*) FILTER (WHERE status = 'INTERESTED')::DECIMAL / COUNT(*)) * 100)
    ELSE 0
  END AS conversion_rate
FROM leads;

-- Employee performance view
CREATE VIEW employee_performance AS
SELECT 
  u.id,
  u.name,
  COUNT(l.id) AS total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'INTERESTED') AS interested_leads,
  CASE 
    WHEN COUNT(l.id) > 0 
    THEN ROUND((COUNT(l.id) FILTER (WHERE l.status = 'INTERESTED')::DECIMAL / COUNT(l.id)) * 100)
    ELSE 0
  END AS conversion_rate
FROM users u
LEFT JOIN leads l ON l.assigned_to = u.id
WHERE u.role IN ('EMPLOYEE', 'ADMIN')
GROUP BY u.id, u.name
ORDER BY conversion_rate DESC;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SEED DATA (Demo Users)
-- =============================================

-- Note: Password is 'password123' hashed with bcrypt
INSERT INTO users (email, password, name, role) VALUES
('admin@crm.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.L6vKFzB1ZLbVyG', 'Super Admin', 'SUPER_ADMIN'),
('manager@crm.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.L6vKFzB1ZLbVyG', 'John Manager', 'ADMIN'),
('employee1@crm.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.L6vKFzB1ZLbVyG', 'Sarah Employee', 'EMPLOYEE'),
('employee2@crm.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.L6vKFzB1ZLbVyG', 'Mike Sales', 'EMPLOYEE'),
('viewer@crm.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.L6vKFzB1ZLbVyG', 'View Only User', 'VIEWER');

-- =============================================
-- SAMPLE LEADS DATA
-- =============================================

INSERT INTO leads (full_name, phone, city, age, gender, status, notes, assigned_to, created_by)
SELECT 
  'Lead ' || i,
  '+1' || (1000000000 + floor(random() * 9000000000))::text,
  (ARRAY['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Paris', 'Casablanca', 'Dubai', 'Cairo', 'Riyadh'])[floor(random() * 10 + 1)],
  floor(random() * 40 + 20)::int,
  (ARRAY['MALE', 'FEMALE']::gender_type[])[floor(random() * 2 + 1)],
  (ARRAY['NEW', 'NO_ANSWER', 'PHONE_OFF', 'NOT_INTERESTED', 'INTERESTED']::lead_status[])[floor(random() * 5 + 1)],
  CASE WHEN random() > 0.7 THEN 'Interested in premium package' ELSE NULL END,
  (SELECT id FROM users WHERE role IN ('EMPLOYEE', 'ADMIN') ORDER BY random() LIMIT 1),
  (SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1)
FROM generate_series(1, 50) AS i;

-- Update updated_by for all leads
UPDATE leads SET updated_by = assigned_to;

-- =============================================
-- SAMPLE MESSAGES
-- =============================================

INSERT INTO messages (from_id, to_id, subject, content, is_broadcast)
SELECT 
  (SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1),
  NULL,
  'Welcome to CRM Pro',
  'Welcome to our new CRM system. Please review the documentation and reach out if you have questions.',
  TRUE;

INSERT INTO messages (from_id, to_id, subject, content, is_broadcast)
SELECT 
  (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1),
  (SELECT id FROM users WHERE role = 'EMPLOYEE' LIMIT 1),
  'Lead Assignment',
  'I have assigned 10 new leads to you. Please follow up by end of week.',
  FALSE;

-- =============================================
-- SAMPLE ACTIVITIES
-- =============================================

INSERT INTO activities (user_id, action, description, entity_type, entity_id)
SELECT 
  (SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1),
  'USER_CREATED',
  'Created new user: John Manager',
  'USER',
  (SELECT id FROM users WHERE email = 'manager@crm.com' LIMIT 1);

INSERT INTO activities (user_id, action, description, entity_type, entity_id)
SELECT 
  (SELECT id FROM users WHERE role = 'EMPLOYEE' LIMIT 1),
  'LEAD_STATUS_UPDATED',
  'Updated lead status to INTERESTED',
  'LEAD',
  (SELECT id FROM leads LIMIT 1);
