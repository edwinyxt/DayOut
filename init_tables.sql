CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR ( 255 ) UNIQUE NOT NULL,
  username VARCHAR ( 50 ) UNIQUE NOT NULL,
  password VARCHAR ( 50 ) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR ( 255 ) UNIQUE NOT NULL,
  description VARCHAR ( 255 ) NOT NULL,
  is_private BOOLEAN,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users_groups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  group_id INTEGER REFERENCES groups(id),
  user_is_admin BOOLEAN
);


CREATE TABLE IF NOT EXISTS events_repository (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  group_id INTEGER REFERENCES groups(id),
  description VARCHAR ( 255 ) NOT NULL,
  link VARCHAR ( 255 ) NOT NULL,
  location VARCHAR ( 255 ) NOT NULL,
  start_date TEXT
  end_date TEXT
);