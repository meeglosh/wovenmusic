-- A) For legacy URLs that contain encoded %2F
update playlists
set image_key = replace(substring(image_url from 'images%2F.*$'), '%2F', '/')
where image_key is null
  and image_url like '%images%25%2F%';

-- B) For plain /images/... URLs
update playlists
set image_key = substring(image_url from 'images/.*$')
where image_key is null
  and image_url like '%/images/%';