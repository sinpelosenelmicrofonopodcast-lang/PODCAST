-- Seed base roles

insert into public.roles (name)
values ('admin'), ('editor'), ('moderator')
on conflict (name) do nothing;

