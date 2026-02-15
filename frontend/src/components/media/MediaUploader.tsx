import { useState, useEffect, useCallback, useRef } from "react"
import {
  X,
  Upload,
  FileText,
  Image,
  Video,
  Music,
  Loader2,
  CheckCircle,
  AlertCircle,
  RotateCcw,
} from "lucide-react"
import { api } from "../../lib/api"
import { useAuthStore } from "../../stores/authStore"
import type { MediaType } from "../../types/media"

interface MediaUploaderProps {
  open: boolean
  onClose: () => void
  onUploaded: () => void
}

type UploadStage = "select" | "details" | "uploading" | "success" | "error"

interface UploadState {
  stage: UploadStage
  file: File | null
  preview: string | null
  title: string
  description: string
  mediaType: MediaType
  progress: number
  errorMessage: string | null
}

const initialState: UploadState = {
  stage: "select",
  file: null,
  preview: null,
  title: "",
  description: "",
  mediaType: "photo",
  progress: 0,
  errorMessage: null,
}

const ACCEPTED_TYPES = "image/*,application/pdf,video/*,audio/*"

function detectMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith("image/")) return "photo"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  return "document"
}

function getMediaTypeIcon(mediaType: MediaType) {
  switch (mediaType) {
    case "photo":
      return Image
    case "video":
      return Video
    case "audio":
      return Music
    case "document":
      return FileText
  }
}

function filenameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1) return filename
  return filename.substring(0, lastDot)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaUploader({
  open,
  onClose,
  onUploaded,
}: MediaUploaderProps) {
  const [state, setState] = useState<UploadState>(initialState)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const user = useAuthStore((s) => s.user)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setState(initialState)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.stage !== "uploading") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose, state.stage])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (state.preview) {
        URL.revokeObjectURL(state.preview)
      }
    }
  }, [state.preview])

  const handleFileSelected = useCallback((file: File) => {
    const mediaType = detectMediaType(file.type)
    const title = filenameWithoutExtension(file.name)
    let preview: string | null = null

    if (file.type.startsWith("image/")) {
      preview = URL.createObjectURL(file)
    }

    setState((prev) => ({
      ...prev,
      stage: "details",
      file,
      preview,
      title,
      mediaType,
      description: "",
      errorMessage: null,
    }))
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        handleFileSelected(droppedFile)
      }
    },
    [handleFileSelected]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        handleFileSelected(selectedFile)
      }
    },
    [handleFileSelected]
  )

  const handleUpload = useCallback(async () => {
    if (!state.file || !user) return

    setState((prev) => ({ ...prev, stage: "uploading", progress: 0 }))

    try {
      // Step 1: Get presigned upload URL
      const uploadUrlRes = await api.post<{
        upload_url: string
        s3_key: string
      }>("/media/upload-url", {
        filename: state.file.name,
        content_type: state.file.type,
      })

      const { upload_url, s3_key } = uploadUrlRes.data

      // Step 2: Upload file to S3 via presigned URL using XMLHttpRequest for progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100)
            setState((prev) => ({ ...prev, progress: percent }))
          }
        })

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener("error", () => {
          reject(new Error("Upload failed. Please check your connection."))
        })

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload cancelled."))
        })

        xhr.open("PUT", upload_url)
        xhr.setRequestHeader("Content-Type", state.file!.type)
        xhr.send(state.file)
      })

      xhrRef.current = null

      // Step 3: Create media record in the database
      // Extract the bucket from the upload URL (between host and key)
      const uploadUrl = new URL(upload_url)
      const s3Bucket = uploadUrl.hostname.split(".")[0] ?? ""

      await api.post("/media/", {
        title: state.title.trim() || null,
        description: state.description.trim() || null,
        media_type: state.mediaType,
        s3_key,
        s3_bucket: s3Bucket,
        file_size_bytes: state.file.size,
        mime_type: state.file.type,
        width: null,
        height: null,
        duration_seconds: null,
        date_taken: null,
        date_taken_approx: false,
        uploaded_by: user.id,
        status: "active",
      })

      setState((prev) => ({ ...prev, stage: "success", progress: 100 }))

      // Auto-close after brief success display
      setTimeout(() => {
        onUploaded()
        onClose()
      }, 1200)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response
                ?.data?.detail ?? "Upload failed. Please try again."
      setState((prev) => ({
        ...prev,
        stage: "error",
        errorMessage: message,
      }))
      xhrRef.current = null
    }
  }, [state.file, state.title, state.description, state.mediaType, user, onUploaded, onClose])

  const handleRetry = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stage: "details",
      progress: 0,
      errorMessage: null,
    }))
  }, [])

  const handleBack = useCallback(() => {
    if (state.preview) {
      URL.revokeObjectURL(state.preview)
    }
    setState(initialState)
  }, [state.preview])

  if (!open) return null

  const FileIcon = state.file
    ? getMediaTypeIcon(state.mediaType)
    : Upload

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={state.stage !== "uploading" ? onClose : undefined}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-dark-card rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={state.stage === "uploading"}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/10 rounded-lg p-2">
            <Upload className="h-5 w-5 text-primary-dark" />
          </div>
          <h2 className="text-xl font-bold text-earth-900 dark:text-dark-text">Upload Media</h2>
        </div>

        {/* ─── Success state ─── */}
        {state.stage === "success" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold text-earth-900 dark:text-dark-text">
              Upload complete!
            </p>
          </div>
        )}

        {/* ─── Error state ─── */}
        {state.stage === "error" && (
          <div className="space-y-5">
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <p className="text-lg font-semibold text-earth-900 dark:text-dark-text">
                Upload Failed
              </p>
              <p className="text-sm text-sage-400 dark:text-dark-text-muted text-center max-w-xs">
                {state.errorMessage}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-200 dark:border-dark-border rounded-lg py-2.5 font-medium text-gray-600 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 flex items-center justify-center gap-2 bg-primary-dark text-white rounded-lg py-2.5 font-semibold hover:bg-primary hover:text-gray-900 dark:hover:text-earth-900 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ─── File selection (drag-and-drop) ─── */}
        {state.stage === "select" && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-4 py-12 px-6 border-2 border-dashed border-sage-300 dark:border-dark-border rounded-xl cursor-pointer hover:border-primary hover:bg-sage-50/50 dark:hover:bg-dark-surface/50 transition-colors"
          >
            <div className="w-14 h-14 rounded-2xl bg-sage-100 dark:bg-dark-surface flex items-center justify-center">
              <Upload className="h-7 w-7 text-sage-400 dark:text-dark-text-muted" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-earth-900 dark:text-dark-text">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-1">
                Images, PDFs, videos, and audio files
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        )}

        {/* ─── Details form ─── */}
        {state.stage === "details" && state.file && (
          <div className="space-y-5">
            {/* File preview */}
            <div className="flex items-center gap-4 bg-sage-50 dark:bg-dark-surface rounded-xl p-4">
              {state.preview ? (
                <img
                  src={state.preview}
                  alt="Preview"
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-sage-100 dark:bg-dark-card flex items-center justify-center flex-shrink-0">
                  <FileIcon className="h-8 w-8 text-sage-400 dark:text-dark-text-muted" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-earth-900 dark:text-dark-text truncate">
                  {state.file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-xs text-sage-400 dark:text-dark-text-muted bg-white dark:bg-dark-card px-2 py-0.5 rounded-full border border-sage-200 dark:border-dark-border">
                    <FileIcon className="h-3 w-3" />
                    {state.mediaType}
                  </span>
                  <span className="text-xs text-sage-400 dark:text-dark-text-muted">
                    {formatFileSize(state.file.size)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-sage-200 dark:hover:bg-dark-surface text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors flex-shrink-0"
                title="Choose different file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-muted mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={state.title}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm text-earth-900 dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                placeholder="Enter a title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-muted mb-1.5">
                Description
              </label>
              <textarea
                value={state.description}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm text-earth-900 dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors resize-none"
                placeholder="Add a description (optional)"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-200 dark:border-dark-border rounded-lg py-2.5 font-medium text-gray-600 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                className="flex-1 flex items-center justify-center gap-2 bg-primary-dark text-white rounded-lg py-2.5 font-semibold hover:bg-primary hover:text-gray-900 dark:hover:text-earth-900 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Upload
              </button>
            </div>
          </div>
        )}

        {/* ─── Uploading state ─── */}
        {state.stage === "uploading" && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm font-semibold text-earth-900 dark:text-dark-text">
                Uploading...
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="w-full h-2 bg-sage-100 dark:bg-dark-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="text-xs text-sage-400 dark:text-dark-text-muted text-center">
                {state.progress}% complete
              </p>
            </div>

            {state.file && (
              <p className="text-xs text-sage-300 dark:text-dark-text-muted text-center truncate">
                {state.file.name}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
