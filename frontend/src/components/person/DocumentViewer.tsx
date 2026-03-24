import { useState } from "react"
import { X, ChevronLeft, ChevronRight, FileText, ZoomIn, ZoomOut, RotateCw } from "lucide-react"

interface MediaItem {
  id: string
  s3_key: string
  title: string | null
  media_type: string
}

interface DocumentViewerProps {
  item: MediaItem
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
}

export function DocumentViewer({ item, onClose, onPrev, onNext, hasPrev, hasNext }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [transcription, setTranscription] = useState("")
  const [showTranscription, setShowTranscription] = useState(false)

  const isImage = item.media_type === "photo" || item.s3_key.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  const isPdf = item.s3_key.match(/\.pdf$/i)

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex" onClick={onClose}>
      {/* Close button */}
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10">
        <X className="h-5 w-5" />
      </button>

      {/* Document viewer */}
      <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {/* Navigation arrows */}
        {hasPrev && onPrev && (
          <button onClick={onPrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {hasNext && onNext && (
          <button onClick={onNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <div className={`${showTranscription ? "w-1/2" : "w-full"} h-full flex flex-col`}>
          {/* Toolbar */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-white text-xs font-mono px-2">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
              <RotateCw className="h-4 w-4" />
            </button>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button
              onClick={() => setShowTranscription(!showTranscription)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showTranscription ? "bg-primary/20 text-primary" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Transcription
            </button>
          </div>

          {/* Document display */}
          <div className="flex-1 overflow-auto flex items-center justify-center">
            {isImage && (
              <img
                src={`/media/${item.s3_key}`}
                alt={item.title ?? "Document"}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s ease",
                }}
                className="max-w-full max-h-full object-contain"
              />
            )}
            {isPdf && (
              <iframe
                src={`/media/${item.s3_key}`}
                className="w-full h-full rounded-lg"
                title={item.title ?? "Document"}
              />
            )}
            {!isImage && !isPdf && (
              <div className="text-center text-white/60">
                <FileText className="h-16 w-16 mx-auto mb-3" />
                <p className="text-sm">Preview not available for this file type.</p>
                <a href={`/media/${item.s3_key}`} target="_blank" rel="noreferrer" className="text-primary text-sm mt-2 inline-block">
                  Download file
                </a>
              </div>
            )}
          </div>

          {/* Caption */}
          {item.title && (
            <p className="text-white text-sm text-center mt-2">{item.title}</p>
          )}
        </div>

        {/* Transcription panel */}
        {showTranscription && (
          <div className="w-1/2 h-full pl-4" onClick={(e) => e.stopPropagation()}>
            <div className="h-full bg-white/10 backdrop-blur-sm rounded-xl p-4 flex flex-col">
              <h3 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Transcription
              </h3>
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder="Type the transcription of this document here..."
                className="flex-1 w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <p className="text-white/40 text-xs mt-2">
                Transcriptions help make documents searchable and accessible.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
