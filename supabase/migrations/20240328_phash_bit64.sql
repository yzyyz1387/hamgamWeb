-- 先删除旧函数（因为返回类型变了）
DROP FUNCTION IF EXISTS find_similar_images(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS find_similar_submissions(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS find_duplicate_images_by_md5(TEXT);
DROP FUNCTION IF EXISTS find_duplicate_submissions_by_md5(TEXT);
DROP FUNCTION IF EXISTS hex_to_binary(TEXT);
DROP FUNCTION IF EXISTS hex_hamming_distance(TEXT, TEXT);

-- 高效的相似图片查找函数（使用位运算）
-- phash 列保持 TEXT 类型存储十六进制字符串
-- 查询时转换为 BIT(64) 进行位运算

CREATE OR REPLACE FUNCTION find_similar_images(
    p_phash_hex TEXT,
    p_threshold INTEGER DEFAULT 10,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    slug TEXT,
    image_url TEXT,
    uploader_display_name TEXT,
    hamming_distance INTEGER
) AS $$
DECLARE
    v_phash BIT(64);
BEGIN
    v_phash := ('x' || p_phash_hex)::BIT(64);
    
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.slug,
        t.image_url,
        t.uploader_display_name,
        t.dist
    FROM (
        SELECT 
            i.id,
            i.title,
            i.slug,
            i.image_url,
            i.uploader_display_name,
            BIT_COUNT(('x' || i.phash)::BIT(64) # v_phash)::INTEGER AS dist
        FROM images i
        WHERE i.phash IS NOT NULL
          AND LENGTH(i.phash) = 16
    ) t
    WHERE t.dist <= p_threshold
      AND t.dist > 0
    ORDER BY t.dist ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_similar_submissions(
    p_phash_hex TEXT,
    p_threshold INTEGER DEFAULT 10,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    status TEXT,
    storage_path TEXT,
    distance INTEGER
) AS $$
DECLARE
    v_phash BIT(64);
BEGIN
    v_phash := ('x' || p_phash_hex)::BIT(64);
    
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        t.status,
        t.storage_path,
        t.dist
    FROM (
        SELECT 
            s.id,
            s.title,
            s.status,
            s.storage_path,
            BIT_COUNT(('x' || s.phash)::BIT(64) # v_phash)::INTEGER AS dist
        FROM submissions s
        WHERE s.phash IS NOT NULL
          AND LENGTH(s.phash) = 16
    ) t
    WHERE t.dist <= p_threshold
      AND t.dist > 0
    ORDER BY t.dist ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_duplicate_images_by_md5(p_md5 TEXT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    slug TEXT,
    image_url TEXT,
    uploader_display_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.title,
        i.slug,
        i.image_url,
        i.uploader_display_name
    FROM images i
    WHERE i.file_md5 = p_md5;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_duplicate_submissions_by_md5(p_md5 TEXT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    status TEXT,
    storage_path TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.status,
        s.storage_path
    FROM submissions s
    WHERE s.file_md5 = p_md5;
END;
$$ LANGUAGE plpgsql;
