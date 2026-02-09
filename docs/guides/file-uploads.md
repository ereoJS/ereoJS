# File Uploads

This guide covers patterns for handling file uploads in EreoJS, from basic form submissions to streaming uploads with progress tracking.

## Basic File Upload

Use a `<Form>` with `encType="multipart/form-data"` and a server action to receive files:

```tsx
// routes/upload.tsx
import { Form } from '@ereo/client'

export default function UploadPage() {
  return (
    <Form method="post" encType="multipart/form-data">
      <label htmlFor="file">Choose a file</label>
      <input type="file" id="file" name="file" />
      <button type="submit">Upload</button>
    </Form>
  )
}
```

### Server Action

```ts
// routes/upload.tsx (action)
import { createAction, redirect } from '@ereo/data'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file || file.size === 0) {
    return { error: 'No file selected' }
  }

  // Write to disk using Bun's file API
  await Bun.write(`./uploads/${file.name}`, file)

  return redirect('/upload?success=true')
})
```

## File Validation

Always validate file type and size on the server:

```ts
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file || file.size === 0) {
    return { error: 'No file selected' }
  }

  if (file.size > MAX_SIZE) {
    return { error: 'File exceeds 10 MB limit' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'File type not allowed. Use JPEG, PNG, WebP, or PDF.' }
  }

  // Generate a unique filename to prevent collisions
  const ext = file.name.split('.').pop()
  const filename = `${crypto.randomUUID()}.${ext}`
  await Bun.write(`./uploads/${filename}`, file)

  return { success: true, filename }
})
```

## Multiple File Uploads

```tsx
// Client
<Form method="post" encType="multipart/form-data">
  <input type="file" name="files" multiple />
  <button type="submit">Upload All</button>
</Form>
```

```ts
// Server action
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  const results = []
  for (const file of files) {
    if (file.size === 0) continue
    const filename = `${crypto.randomUUID()}-${file.name}`
    await Bun.write(`./uploads/${filename}`, file)
    results.push({ name: file.name, filename })
  }

  return { uploaded: results }
})
```

## Streaming Uploads

For large files, process the stream directly without buffering the entire file in memory:

```ts
// routes/api/upload-stream.ts
import type { ActionArgs } from '@ereo/core'

export async function POST({ request }: ActionArgs) {
  const contentType = request.headers.get('Content-Type') || ''

  if (!contentType.startsWith('application/octet-stream')) {
    return Response.json({ error: 'Expected binary stream' }, { status: 400 })
  }

  const filename = request.headers.get('X-Filename') || `${crypto.randomUUID()}.bin`
  const writer = Bun.file(`./uploads/${filename}`).writer()

  const reader = request.body?.getReader()
  if (!reader) {
    return Response.json({ error: 'No body' }, { status: 400 })
  }

  let bytesWritten = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    writer.write(value)
    bytesWritten += value.byteLength
  }

  await writer.end()

  return Response.json({ filename, size: bytesWritten })
}
```

## Uploading to S3

Use an S3-compatible client to store files in cloud storage:

```ts
// lib/storage.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function uploadToS3(file: File, key: string) {
  const buffer = await file.arrayBuffer()

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: file.type,
    })
  )

  return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`
}
```

```ts
// routes/api/upload.ts
import type { ActionArgs } from '@ereo/core'
import { uploadToS3 } from '../../lib/storage'

export async function POST({ request }: ActionArgs) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  const key = `uploads/${crypto.randomUUID()}-${file.name}`
  const url = await uploadToS3(file, key)

  return Response.json({ url })
}
```

## Progress Tracking with Islands

Track upload progress by using `XMLHttpRequest` in an island component:

```tsx
// components/upload-form.island.tsx
import { useState, useRef } from 'react'

export default function UploadForm() {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = () => {
    const file = inputRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      setUploading(false)
      setProgress(100)
    }

    xhr.onerror = () => {
      setUploading(false)
      setProgress(0)
    }

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }

  return (
    <div>
      <input ref={inputRef} type="file" disabled={uploading} />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? `Uploading ${progress}%` : 'Upload'}
      </button>
      {uploading && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
```

## Related

- [Forms (Basic)](/guides/forms-basic) — Form handling with the `@ereo/client` Form component
- [Islands](/concepts/islands) — Hydrating interactive components
- [API Routes](/guides/api-routes) — Building REST APIs
