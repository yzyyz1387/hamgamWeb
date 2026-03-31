-- 允许 submissions 表的 storage_bucket 和 storage_path 为 NULL
-- 这是为了支持只修改标题/描述而不上传新文件的编辑请求

-- 移除 storage_path 的 NOT NULL 约束
ALTER TABLE public.submissions 
ALTER COLUMN storage_path DROP NOT NULL;

-- 移除 storage_bucket 的 NOT NULL 约束（保留默认值）
ALTER TABLE public.submissions 
ALTER COLUMN storage_bucket DROP NOT NULL;

-- 添加智能校验约束：
-- 如果是"修改申请"（metadata 里有 edit_for_image_id），则允许没有图片；
-- 如果是"全新投稿"，则 storage_path 和 storage_bucket 必须存在！
ALTER TABLE public.submissions
ADD CONSTRAINT check_storage_path_requirement 
CHECK ( 
  (metadata->>'edit_for_image_id' IS NOT NULL) 
  OR 
  (storage_path IS NOT NULL AND storage_bucket IS NOT NULL) 
);
