-- 为 submissions 表添加 RLS 策略，允许用户删除自己的投稿

-- 首先确保 RLS 已启用
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 允许用户查看自己的投稿
CREATE POLICY "Users can view own submissions"
ON submissions
FOR SELECT
TO authenticated
USING (uploader_id = auth.uid());

-- 允许用户插入投稿
CREATE POLICY "Users can insert submissions"
ON submissions
FOR INSERT
TO authenticated
WITH CHECK (uploader_id = auth.uid());

-- 允许用户更新自己的投稿
CREATE POLICY "Users can update own submissions"
ON submissions
FOR UPDATE
TO authenticated
USING (uploader_id = auth.uid())
WITH CHECK (uploader_id = auth.uid());

-- 允许用户删除自己的投稿（仅限 PENDING 或 REJECTED 状态）
CREATE POLICY "Users can delete own pending or rejected submissions"
ON submissions
FOR DELETE
TO authenticated
USING (
  uploader_id = auth.uid() 
  AND status IN ('PENDING', 'REJECTED')
);

-- 允许审核员查看所有投稿
CREATE POLICY "Reviewers can view all submissions"
ON submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('REVIEWER', 'SUPER_ADMIN')
  )
);

-- 允许审核员更新投稿状态
CREATE POLICY "Reviewers can update submissions"
ON submissions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('REVIEWER', 'SUPER_ADMIN')
  )
);
