import { useState, useRef, useCallback } from "react"
import { Mic, Square, Play, Pause, Upload, Loader2, Trash2 } from "lucide-react"
import { api } from "../../lib/api"
import { cn } from "../../lib/utils"

interface AudioRecorderProps {
  personId: string
  onUploaded?: (s3Key: string) => void
}

export function AudioRecorder({ personId, onUploaded }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      setError("Microphone access denied. Please allow microphone access in your browser settings.")
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }, [audioUrl, isPlaying])

  const handleUpload = useCallback(async () => {
    if (!audioBlob) return
    setIsUploading(true)
    setError(null)

    try {
      // Get presigned upload URL
      const { data: uploadData } = await api.post(`/persons/${personId}/profile-photo/upload-url`, {
        filename: `audio-${Date.now()}.webm`,
        content_type: "audio/webm",
      })

      // Upload to S3
      await fetch(uploadData.upload_url, {
        method: "PUT",
        headers: { "Content-Type": "audio/webm" },
        body: audioBlob,
      })

      onUploaded?.(uploadData.s3_key)
      setAudioBlob(null)
      setAudioUrl(null)
    } catch {
      setError("Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }, [audioBlob, personId, onUploaded])

  const discard = useCallback(() => {
    setAudioBlob(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setIsPlaying(false)
  }, [audioUrl])

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      {!audioBlob ? (
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
            isRecording
              ? "bg-red-500 text-white animate-pulse hover:bg-red-600"
              : "bg-sage-50 dark:bg-dark-surface border border-sage-200 dark:border-dark-border text-earth-900 dark:text-dark-text hover:bg-sage-100 dark:hover:bg-dark-card",
          )}
        >
          {isRecording ? (
            <><Square className="h-4 w-4" /> Stop Recording</>
          ) : (
            <><Mic className="h-4 w-4" /> Record Audio</>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-2 bg-sage-50 dark:bg-dark-surface rounded-xl border border-sage-200 dark:border-dark-border p-3">
          <button onClick={togglePlayback}
            className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary-dark hover:bg-primary/20 transition-colors">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex-1">
            <p className="text-xs text-earth-900 dark:text-dark-text font-medium">Recording ready</p>
            <p className="text-[10px] text-sage-400">Review before uploading</p>
          </div>
          <button onClick={handleUpload} disabled={isUploading}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary-dark text-white text-xs font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
            {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Upload
          </button>
          <button onClick={discard} className="p-1.5 text-sage-400 hover:text-red-500 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}
        </div>
      )}
    </div>
  )
}
