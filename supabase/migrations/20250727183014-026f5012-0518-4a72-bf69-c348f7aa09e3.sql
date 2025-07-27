-- Function to transfer playlist ownership to an admin when a user is deleted
CREATE OR REPLACE FUNCTION public.transfer_playlist_ownership_to_admin(deleted_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_admin_id UUID;
BEGIN
  -- Find the best admin to transfer ownership to
  -- Priority: earliest created admin who is still a band member
  SELECT id INTO target_admin_id
  FROM public.profiles 
  WHERE is_admin = true 
    AND is_band_member = true 
    AND id != deleted_user_id
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- If no admin found, return null (shouldn't happen in normal scenarios)
  IF target_admin_id IS NULL THEN
    -- Log this as it's an unusual situation
    PERFORM log_security_event(
      'playlist_transfer_no_admin_found',
      jsonb_build_object(
        'deleted_user_id', deleted_user_id,
        'message', 'No admin found to transfer playlists to'
      )
    );
    RETURN NULL;
  END IF;
  
  -- Transfer ownership of all playlists from deleted user to the admin
  UPDATE public.playlists 
  SET 
    created_by = target_admin_id,
    updated_at = NOW()
  WHERE created_by = deleted_user_id;
  
  -- Log the transfer for audit purposes
  PERFORM log_security_event(
    'playlist_ownership_transferred',
    jsonb_build_object(
      'deleted_user_id', deleted_user_id,
      'new_owner_id', target_admin_id,
      'transferred_count', (
        SELECT COUNT(*) 
        FROM public.playlists 
        WHERE created_by = target_admin_id 
          AND updated_at = NOW()
      )
    )
  );
  
  RETURN target_admin_id;
END;
$$;

-- Function to handle user deletion and playlist transfer
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  playlist_count INTEGER;
BEGIN
  -- Count playlists owned by the user being deleted
  SELECT COUNT(*) INTO playlist_count
  FROM public.playlists 
  WHERE created_by = OLD.id;
  
  -- If user owns playlists, transfer them to an admin
  IF playlist_count > 0 THEN
    PERFORM transfer_playlist_ownership_to_admin(OLD.id);
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create trigger to handle playlist ownership transfer on user deletion
CREATE TRIGGER on_user_profile_deleted
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_deletion();