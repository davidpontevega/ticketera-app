"use client";

import { useState, type DragEvent } from "react";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { EVENT_COVER_MAX_BYTES, EVENT_COVER_TYPES } from "../constants/organizer.constants";

export interface EventCoverFieldProps {
  id: string;
  value: string; // data URL o https
  error?: string;
  onChange: (imageUrl: string) => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function EventCoverField({ id, value, error, onChange }: EventCoverFieldProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const message = fileError ?? error;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!(EVENT_COVER_TYPES as readonly string[]).includes(file.type)) {
      setFileError("La imagen debe ser JPG o PNG");
      return;
    }
    if (file.size > EVENT_COVER_MAX_BYTES) {
      setFileError("La imagen debe pesar menos de 1 MB");
      return;
    }
    setFileError(null);
    onChange(await readAsDataUrl(file));
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  };

  if (value) {
    return (
      <div className="flex flex-col gap-3">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
          <Image
            src={value}
            alt="Portada del evento"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            unoptimized={value.startsWith("data:")}
            className="object-cover"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => onChange("")} className="h-10 w-fit">
          <Trash2 aria-hidden />
          Quitar imagen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
          message && "border-destructive",
        )}
      >
        <ImagePlus className="size-8 text-primary" aria-hidden />
        <span className="font-semibold">Arrastra una imagen o haz clic para subirla</span>
        <span className="text-sm text-muted-foreground">
          JPG o PNG, horizontal (16:9), hasta 1 MB
        </span>
        <input
          id={id}
          type="file"
          accept={EVENT_COVER_TYPES.join(",")}
          aria-invalid={Boolean(message)}
          aria-describedby={message ? `${id}-error` : undefined}
          onChange={(event) => void handleFile(event.target.files?.[0])}
          className="sr-only"
        />
      </label>
      {message && <FieldError id={`${id}-error`}>{message}</FieldError>}
    </div>
  );
}
