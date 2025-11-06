import { useState, useRef } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Image, Video, Mic, FileText } from "lucide-react";

interface MediaUploadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageFromGallery: (files: FileList | null) => void;
  onImageFromCamera: () => void;
  onVideoFromGallery: (files: FileList | null) => void;
  onVideoRecord: () => void;
  onAudioFromFiles: (files: FileList | null) => void;
  onAudioRecord: () => void;
  onFileSelect: (files: FileList | null) => void;
}

export function MediaUploadSheet({
  open,
  onOpenChange,
  onImageFromGallery,
  onImageFromCamera,
  onVideoFromGallery,
  onVideoRecord,
  onAudioFromFiles,
  onAudioRecord,
  onFileSelect,
}: MediaUploadSheetProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showAudioDialog, setShowAudioDialog] = useState(false);

  const imageGalleryInputRef = useRef<HTMLInputElement>(null);
  const imageCameraInputRef = useRef<HTMLInputElement>(null);
  const videoGalleryInputRef = useRef<HTMLInputElement>(null);
  const audioFilesInputRef = useRef<HTMLInputElement>(null);
  const documentsInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    setShowImageDialog(true);
  };

  const handleVideoClick = () => {
    setShowVideoDialog(true);
  };

  const handleAudioClick = () => {
    setShowAudioDialog(true);
  };

  const handleDocumentsClick = () => {
    documentsInputRef.current?.click();
    onOpenChange(false);
  };

  const handleImageFromGallery = () => {
    imageGalleryInputRef.current?.click();
    setShowImageDialog(false);
    onOpenChange(false);
  };

  const handleImageFromCamera = () => {
    imageCameraInputRef.current?.click();
    setShowImageDialog(false);
    onOpenChange(false);
  };

  const handleVideoFromGallery = () => {
    videoGalleryInputRef.current?.click();
    setShowVideoDialog(false);
    onOpenChange(false);
  };

  const handleVideoRecord = () => {
    setShowVideoDialog(false);
    onOpenChange(false);
    onVideoRecord();
  };

  const handleAudioFromFiles = () => {
    audioFilesInputRef.current?.click();
    setShowAudioDialog(false);
    onOpenChange(false);
  };

  const handleAudioRecord = () => {
    setShowAudioDialog(false);
    onOpenChange(false);
    onAudioRecord();
  };

  return (
    <>
      {/* Hidden File Inputs */}
      <input
        ref={imageGalleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onImageFromGallery(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={imageCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onImageFromGallery(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={videoGalleryInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onVideoFromGallery(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={audioFilesInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          onAudioFromFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={documentsInputRef}
        type="file"
        accept="application/pdf,.pdf,application/*,text/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onFileSelect(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Main Upload Sheet */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Medien hochladen</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-4 mt-6 mb-4">
            {/* Photo/Image Button */}
            <button
              onClick={handleImageClick}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation min-h-[120px]"
            >
              <Image className="w-10 h-10 text-primary" />
              <span className="text-sm font-medium">Foto/Bild</span>
            </button>

            {/* Video Button */}
            <button
              onClick={handleVideoClick}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation min-h-[120px]"
            >
              <Video className="w-10 h-10 text-primary" />
              <span className="text-sm font-medium">Video</span>
            </button>

            {/* Audio Button */}
            <button
              onClick={handleAudioClick}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation min-h-[120px]"
            >
              <Mic className="w-10 h-10 text-primary" />
              <span className="text-sm font-medium">Sprachnachricht</span>
            </button>

            {/* Documents Button */}
            <button
              onClick={handleDocumentsClick}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation min-h-[120px]"
            >
              <FileText className="w-10 h-10 text-primary" />
              <span className="text-sm font-medium">Dokumente</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Image Upload Dialog */}
      <AlertDialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foto hochladen</AlertDialogTitle>
            <AlertDialogDescription>
              Wähle eine Option zum Hochladen eines Fotos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 my-4">
            <button
              onClick={handleImageFromGallery}
              className="flex items-center justify-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
            >
              <Image className="w-5 h-5" />
              <span className="font-medium">Aus Galerie wählen</span>
            </button>
            <button
              onClick={handleImageFromCamera}
              className="flex items-center justify-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
            >
              <Image className="w-5 h-5" />
              <span className="font-medium">Kamera öffnen</span>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Video Upload Dialog */}
      <AlertDialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Video hochladen</AlertDialogTitle>
            <AlertDialogDescription>
              Wähle eine Option zum Hochladen eines Videos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 my-4">
            <button
              onClick={handleVideoFromGallery}
              className="flex items-center justify-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
            >
              <Video className="w-5 h-5" />
              <span className="font-medium">Aus Galerie wählen</span>
            </button>
            <button
              onClick={handleVideoRecord}
              className="flex items-center justify-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
            >
              <Video className="w-5 h-5" />
              <span className="font-medium">Video aufnehmen</span>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Audio Upload Dialog */}
      <AlertDialog open={showAudioDialog} onOpenChange={setShowAudioDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sprachnachricht</AlertDialogTitle>
            <AlertDialogDescription>
              Wähle eine Option für eine Sprachnachricht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 my-4">
            <button
              onClick={handleAudioFromFiles}
              className="flex items-center justify-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
            >
              <Mic className="w-5 h-5" />
              <span className="font-medium">Aus Dateien wählen</span>
            </button>
            <button
              onClick={handleAudioRecord}
              className="flex items-center justify-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
            >
              <Mic className="w-5 h-5" />
              <span className="font-medium">Aufnehmen</span>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
