-- ==========================================
-- ROBUSTNESS CONSTRAINTS MIGRATION
-- Adds additional constraints and validations for data integrity
-- ==========================================

-- Add length constraints for text fields to prevent abuse
ALTER TABLE profiles 
  ADD CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 100),
  ADD CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 500),
  ADD CONSTRAINT profiles_display_name_not_empty CHECK (trim(display_name) != '');

-- Add constraints for works
ALTER TABLE works 
  ADD CONSTRAINT works_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
  ADD CONSTRAINT works_synopsis_length CHECK (synopsis IS NULL OR char_length(synopsis) <= 2000),
  ADD CONSTRAINT works_title_not_empty CHECK (trim(title) != ''),
  ADD CONSTRAINT works_isbn_format CHECK (isbn IS NULL OR isbn ~ '^[0-9\-X]{10,17}$');

-- Add constraints for posts
ALTER TABLE posts 
  ADD CONSTRAINT posts_title_length CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 300),
  ADD CONSTRAINT posts_content_length CHECK (char_length(content) BETWEEN 1 AND 100000),
  ADD CONSTRAINT posts_content_not_empty CHECK (trim(content) != ''),
  ADD CONSTRAINT posts_chapter_index_positive CHECK (chapter_index IS NULL OR chapter_index > 0),
  ADD CONSTRAINT posts_title_required_for_chapters CHECK (
    (type = 'chapter' AND title IS NOT NULL) OR type != 'chapter'
  ),
  ADD CONSTRAINT posts_work_id_required_for_chapters CHECK (
    (type = 'chapter' AND work_id IS NOT NULL) OR type != 'chapter'
  );

-- Prevent self-following
ALTER TABLE follows 
  ADD CONSTRAINT follows_no_self_follow CHECK (follower_id != following_id);

-- Add audit fields for better tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE works ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_works_updated_at ON works;
CREATE TRIGGER update_works_updated_at 
    BEFORE UPDATE ON works 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at 
    BEFORE UPDATE ON posts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add function to validate post content for security
CREATE OR REPLACE FUNCTION validate_post_content()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for potentially malicious content patterns
    IF NEW.content ~* '<script|javascript:|data:|vbscript:|onload|onerror|onclick' THEN
        RAISE EXCEPTION 'Content contains potentially malicious code';
    END IF;
    
    -- Check for excessive HTML tags (basic protection)
    IF (char_length(NEW.content) - char_length(regexp_replace(NEW.content, '<[^>]*>', '', 'g'))) > 
       (char_length(NEW.content) * 0.3) THEN
        RAISE EXCEPTION 'Content contains excessive HTML markup';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for post content validation
DROP TRIGGER IF EXISTS validate_post_content_trigger ON posts;
CREATE TRIGGER validate_post_content_trigger 
    BEFORE INSERT OR UPDATE ON posts 
    FOR EACH ROW EXECUTE FUNCTION validate_post_content();

-- Add function to prevent spam (rate limiting at DB level)
CREATE OR REPLACE FUNCTION check_post_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    recent_posts_count INTEGER;
BEGIN
    -- Count posts from the same user in the last 5 minutes
    SELECT COUNT(*) INTO recent_posts_count
    FROM posts 
    WHERE author_id = NEW.author_id 
    AND created_at > (now() - interval '5 minutes');
    
    -- Allow maximum 5 posts per 5 minutes per user
    IF recent_posts_count >= 5 THEN
        RAISE EXCEPTION 'Rate limit exceeded: too many posts in a short time';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for rate limiting
DROP TRIGGER IF EXISTS check_post_rate_limit_trigger ON posts;
CREATE TRIGGER check_post_rate_limit_trigger 
    BEFORE INSERT ON posts 
    FOR EACH ROW EXECUTE FUNCTION check_post_rate_limit();

-- Add function to validate profile data
CREATE OR REPLACE FUNCTION validate_profile_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate display name doesn't contain only special characters
    IF NEW.display_name !~ '[a-zA-Z0-9]' THEN
        RAISE EXCEPTION 'Display name must contain at least one alphanumeric character';
    END IF;
    
    -- Validate avatar URL format if provided
    IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url !~ '^https?://' THEN
        RAISE EXCEPTION 'Avatar URL must be a valid HTTP/HTTPS URL';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for profile validation
DROP TRIGGER IF EXISTS validate_profile_data_trigger ON profiles;
CREATE TRIGGER validate_profile_data_trigger 
    BEFORE INSERT OR UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION validate_profile_data();

-- Add additional indexes for performance and security
CREATE INDEX IF NOT EXISTS idx_posts_content_search ON posts USING gin(to_tsvector('spanish', content));
CREATE INDEX IF NOT EXISTS idx_posts_title_search ON posts USING gin(to_tsvector('spanish', title));
CREATE INDEX IF NOT EXISTS idx_works_title_search ON works USING gin(to_tsvector('spanish', title));
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_search ON profiles USING gin(to_tsvector('spanish', display_name));

-- Add partial indexes for better performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_posts_published_recent ON posts (published_at DESC) 
    WHERE status = 'published' AND published_at > (now() - interval '30 days');

CREATE INDEX IF NOT EXISTS idx_posts_draft_by_author ON posts (author_id, updated_at DESC) 
    WHERE status = 'draft';

-- Add constraint to ensure published posts have published_at timestamp
ALTER TABLE posts 
  ADD CONSTRAINT posts_published_at_required CHECK (
    (status = 'published' AND published_at IS NOT NULL) OR status != 'published'
  );

-- Add constraint to ensure works have valid author
ALTER TABLE works 
  ADD CONSTRAINT works_author_exists CHECK (author_id IS NOT NULL);

-- Add constraint to ensure posts have valid author
ALTER TABLE posts 
  ADD CONSTRAINT posts_author_exists CHECK (author_id IS NOT NULL);

-- Create view for post statistics (useful for monitoring)
CREATE OR REPLACE VIEW post_statistics AS
SELECT 
    author_id,
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE status = 'published') as published_posts,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_posts,
    COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') as posts_last_24h,
    MAX(created_at) as last_post_date
FROM posts 
GROUP BY author_id;

-- Grant appropriate permissions
GRANT SELECT ON post_statistics TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE profiles IS 'User profiles with enhanced validation constraints';
COMMENT ON TABLE works IS 'Literary works with title and content validation';
COMMENT ON TABLE posts IS 'Posts/chapters with content validation and rate limiting';
COMMENT ON VIEW post_statistics IS 'Aggregated statistics for user posts';

-- Log the migration completion
INSERT INTO public.migration_log (migration_name, applied_at) 
VALUES ('20250126000000_add_robustness_constraints', now())
ON CONFLICT DO NOTHING;