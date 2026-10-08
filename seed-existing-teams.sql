-- Optional: the 8 teams you already entered in the Claude version.
-- Run after schema.sql. Rename them later from the Manage tab if you like.
insert into public.teams (name, grp) values
  ('TEAM 2', 'A'),
  ('TEAM 3', 'A'),
  ('TEAM 4', 'A'),
  ('Bhabhi FC', 'A'),
  ('TEAM 5', 'B'),
  ('team 6', 'B'),
  ('TEAM 7', 'B'),
  ('team 8', 'B')
on conflict do nothing;
