import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function createSlug(input: string) {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  if (normalized) return normalized

  let hash = 0
  for (const char of input) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash |= 0
  }
  return `image-${Math.abs(hash).toString(36)}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey =
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Missing Supabase environment variables.' }, 500)
    }

    const authHeader = request.headers.get('Authorization') || ''

    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.slice('Bearer '.length).trim()

    if (!token) {
      return jsonResponse({ error: 'Missing access token' }, 401)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token)

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized', detail: userError?.message ?? null }, 401)
    }

    const { data: actorProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, nickname, avatar_url, role, is_active')
      .eq('id', user.id)
      .single()

    if (profileError || !actorProfile) {
      return jsonResponse({ error: 'Actor profile not found' }, 403)
    }

    if (!actorProfile.is_active || !['SUPER_ADMIN', 'REVIEWER'].includes(actorProfile.role)) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    let payload: { submissionId?: string; action?: string; note?: string }
    try {
      payload = await request.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const submissionId = payload.submissionId
    const action = payload.action
    const note = (payload.note || '').trim().slice(0, 500)

    if (!submissionId || !['publish', 'reject'].includes(action || '')) {
      return jsonResponse({ error: 'submissionId and action are required' }, 400)
    }

    const { data: submission, error: submissionError } = await adminClient
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single()

    if (submissionError || !submission) {
      return jsonResponse({ error: 'Submission not found' }, 404)
    }

    if (submission.status !== 'PENDING') {
      return jsonResponse({
        error: '该投稿已被其他审核员处理',
        code: 'ALREADY_MODERATED',
      }, 409)
    }

    if (action === 'reject') {
      const { data: rejectData, error: rejectError } = await adminClient
        .from('submissions')
        .update({
          status: 'REJECTED',
          reviewer_id: actorProfile.id,
          reviewer_note: note || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId)
        .eq('status', 'PENDING')
        .select('id')

      if (rejectError) {
        return jsonResponse({ error: rejectError.message }, 500)
      }

      if (!rejectData || rejectData.length === 0) {
        return jsonResponse({
          error: '该投稿已被其他审核员处理',
          code: 'ALREADY_MODERATED',
        }, 409)
      }

      await adminClient.from('submission_reviews').insert({
        submission_id: submissionId,
        reviewer_id: actorProfile.id,
        reviewer_display_name: actorProfile.nickname,
        action: 'REJECTED',
        note: note || null,
      })

      await adminClient.from('notifications').insert({
        user_id: submission.uploader_id,
        actor_id: actorProfile.id,
        actor_display_name: actorProfile.nickname,
        actor_avatar_url: actorProfile.avatar_url,
        type: 'SUBMISSION_REJECTED',
        title: '你的投稿未通过审核',
        content: note || `《${submission.title}》未通过审核，请修改后再次提交。`,
        link: '/my-submissions',
        metadata: { submission_id: submissionId },
      })

      await adminClient.from('audit_logs').insert({
        actor_id: actorProfile.id,
        action: 'submission.rejected',
        entity_type: 'submission',
        entity_id: submissionId,
        details: { title: submission.title, reviewer_note: note },
      })

      return jsonResponse({ ok: true, status: 'REJECTED' })
    }

    const isEdit = submission.metadata?.edit_for_image_id
    const hasNewFile = submission.metadata?.has_new_file && submission.storage_path

    if (isEdit) {
      const { data: originalImage, error: imageFindError } = await adminClient
        .from('images')
        .select('*')
        .eq('id', submission.metadata.edit_for_image_id)
        .single()

      if (imageFindError || !originalImage) {
        return jsonResponse({ error: 'Original image not found for edit' }, 404)
      }

      let updateData: Record<string, unknown> = {
        title: submission.title,
        description: submission.description || '',
        edit_status: null,
        edit_reason: null,
      }

      if (hasNewFile) {
        const { data: sourceFile, error: downloadError } = await adminClient.storage
          .from(submission.storage_bucket)
          .download(submission.storage_path)

        if (downloadError || !sourceFile) {
          return jsonResponse({ error: downloadError?.message || 'Failed to read source image' }, 500)
        }

        const ext = submission.original_filename?.includes('.')
          ? submission.original_filename.split('.').pop()?.toLowerCase()
          : 'png'
        const targetPath = `approved/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${originalImage.slug}.${ext}`

        const { error: uploadError } = await adminClient.storage
          .from('gallery-images')
          .upload(targetPath, sourceFile, {
            contentType: submission.mime_type || 'image/*',
            upsert: false,
          })

        if (uploadError) {
          return jsonResponse({ error: uploadError.message }, 500)
        }

        const {
          data: { publicUrl },
        } = adminClient.storage.from('gallery-images').getPublicUrl(targetPath)

        updateData = {
          ...updateData,
          storage_path: targetPath,
          image_url: publicUrl,
          mime_type: submission.mime_type,
          file_size: submission.file_size,
        }
      }

      const { error: updateImageError } = await adminClient
        .from('images')
        .update(updateData)
        .eq('id', originalImage.id)

      if (updateImageError) {
        return jsonResponse({ error: updateImageError.message }, 500)
      }

      const { data: updateSubmissionData, error: updateSubmissionError } = await adminClient
        .from('submissions')
        .update({
          status: 'PUBLISHED',
          reviewer_id: actorProfile.id,
          reviewer_note: note || null,
          reviewed_at: new Date().toISOString(),
          published_image_id: originalImage.id,
        })
        .eq('id', submissionId)
        .eq('status', 'PENDING')
        .select('id')

      if (updateSubmissionError) {
        return jsonResponse({ error: updateSubmissionError.message }, 500)
      }

      if (!updateSubmissionData || updateSubmissionData.length === 0) {
        return jsonResponse({
          error: '该投稿已被其他审核员处理',
          code: 'ALREADY_MODERATED',
        }, 409)
      }

      await adminClient.from('submission_reviews').insert({
        submission_id: submissionId,
        reviewer_id: actorProfile.id,
        reviewer_display_name: actorProfile.nickname,
        action: 'APPROVED',
        note: note || null,
      })

      await adminClient.from('notifications').insert({
        user_id: submission.uploader_id,
        actor_id: actorProfile.id,
        actor_display_name: actorProfile.nickname,
        actor_avatar_url: actorProfile.avatar_url,
        type: 'SUBMISSION_PUBLISHED',
        title: '你的图片修改已通过审核',
        content: note || `《${submission.title}》的修改已生效。`,
        link: `/image/${originalImage.slug}`,
        metadata: {
          submission_id: submissionId,
          image_id: originalImage.id,
        },
      })

      await adminClient.from('audit_logs').insert({
        actor_id: actorProfile.id,
        action: 'image.edit_approved',
        entity_type: 'image',
        entity_id: originalImage.id,
        details: {
          title: submission.title,
          image_id: originalImage.id,
          image_slug: originalImage.slug,
          reviewer_note: note,
        },
      })

      return jsonResponse({
        ok: true,
        status: 'PUBLISHED',
        imageId: originalImage.id,
        slug: originalImage.slug,
      })
    }

    if (!submission.storage_path) {
      return jsonResponse({ error: 'Submission has no storage_path' }, 400)
    }

    const { data: lockData, error: lockError } = await adminClient
      .from('submissions')
      .update({
        status: 'PUBLISHED',
        reviewer_id: actorProfile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .eq('status', 'PENDING')
      .select('id')

    if (lockError) {
      return jsonResponse({ error: lockError.message }, 500)
    }

    if (!lockData || lockData.length === 0) {
      return jsonResponse({
        error: '该投稿已被其他审核员处理',
        code: 'ALREADY_MODERATED',
      }, 409)
    }

    const { data: sourceFile, error: downloadError } = await adminClient.storage
      .from(submission.storage_bucket)
      .download(submission.storage_path)

    if (downloadError || !sourceFile) {
      await adminClient
        .from('submissions')
        .update({ status: 'PENDING', reviewer_id: null, reviewed_at: null })
        .eq('id', submissionId)
      return jsonResponse({ error: downloadError?.message || 'Failed to read source image' }, 500)
    }

    const ext = submission.original_filename?.includes('.')
      ? submission.original_filename.split('.').pop()?.toLowerCase()
      : 'png'
    const slug = createSlug(submission.title || submission.original_filename || submissionId)
    const targetPath = `approved/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${slug}.${ext}`

    const { error: uploadError } = await adminClient.storage
      .from('gallery-images')
      .upload(targetPath, sourceFile, {
        contentType: submission.mime_type || 'image/*',
        upsert: false,
      })

    if (uploadError) {
      await adminClient
        .from('submissions')
        .update({ status: 'PENDING', reviewer_id: null, reviewed_at: null })
        .eq('id', submissionId)
      return jsonResponse({ error: uploadError.message }, 500)
    }

    const {
      data: { publicUrl },
    } = adminClient.storage.from('gallery-images').getPublicUrl(targetPath)

    const { data: image, error: imageError } = await adminClient
      .from('images')
      .insert({
        slug,
        title: submission.title,
        description: submission.description || '',
        contributor_name: submission.contributor_name || submission.uploader_display_name,
        uploader_id: submission.uploader_id,
        uploader_display_name: submission.uploader_display_name,
        storage_bucket: 'gallery-images',
        storage_path: targetPath,
        image_url: publicUrl,
        mime_type: submission.mime_type,
        file_size: submission.file_size,
        status: 'PUBLISHED',
        published_at: new Date().toISOString(),
        metadata: {
          source_submission_id: submissionId,
          original_submission_path: submission.storage_path,
        },
      })
      .select('*')
      .single()

    if (imageError || !image) {
      await adminClient
        .from('submissions')
        .update({ status: 'PENDING', reviewer_id: null, reviewed_at: null })
        .eq('id', submissionId)
      return jsonResponse({ error: imageError?.message || 'Failed to insert image row' }, 500)
    }

    const { error: updateSubmissionError } = await adminClient
      .from('submissions')
      .update({
        reviewer_note: note || null,
        published_image_id: image.id,
      })
      .eq('id', submissionId)

    if (updateSubmissionError) {
      return jsonResponse({ error: updateSubmissionError.message }, 500)
    }

    await adminClient.from('submission_reviews').insert({
      submission_id: submissionId,
      reviewer_id: actorProfile.id,
      reviewer_display_name: actorProfile.nickname,
      action: 'APPROVED',
      note: note || null,
    })

    await adminClient.from('notifications').insert({
      user_id: submission.uploader_id,
      actor_id: actorProfile.id,
      actor_display_name: actorProfile.nickname,
      actor_avatar_url: actorProfile.avatar_url,
      type: 'SUBMISSION_PUBLISHED',
      title: '你的投稿已通过审核',
      content: note || `《${submission.title}》已经发布到图集。`,
      link: `/image/${image.slug}`,
      metadata: {
        submission_id: submissionId,
        image_id: image.id,
      },
    })

    await adminClient.from('audit_logs').insert({
      actor_id: actorProfile.id,
      action: 'submission.published',
      entity_type: 'submission',
      entity_id: submissionId,
      details: {
        title: submission.title,
        image_id: image.id,
        image_slug: image.slug,
        reviewer_note: note,
      },
    })

    return jsonResponse({
      ok: true,
      status: 'PUBLISHED',
      imageId: image.id,
      slug: image.slug,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected moderate-submission error'
    return jsonResponse({ error: message }, 500)
  }
})
