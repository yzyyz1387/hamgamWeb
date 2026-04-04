drop function if exists public.find_duplicate_images_by_md5(text);
drop function if exists public.find_duplicate_images_by_md5(varchar);

create or replace function public.find_duplicate_images_by_md5(p_md5 text)
returns table (
  id uuid,
  title text,
  image_url text,
  uploader_display_name text,
  slug text
)
language sql
stable
set search_path = public
as $$
  select i.id, i.title, i.image_url, i.uploader_display_name, i.slug
  from public.images i
  where i.file_md5 = p_md5;
$$;
