-- Fix the last remaining function security issue

CREATE OR REPLACE FUNCTION public.handle_user_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  playlist_count INTEGER;
BEGIN
  -- Count playlists owned by the user being deleted
  SELECT COUNT(*) INTO playlist_count
  FROM public.playlists 
  WHERE created_by = OLD.id;
  
  -- Return early if no playlists owned (performance optimization)
  IF playlist_count = 0 THEN
    RETURN OLD;
  END IF;
  
  -- Transfer playlists to an admin
  PERFORM public.transfer_playlist_ownership_to_admin(OLD.id);
  
  RETURN OLD;
END;
$function$;