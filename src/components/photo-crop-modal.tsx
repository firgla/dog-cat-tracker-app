/* eslint-disable @next/next/no-img-element */
"use client";

import type { ChangeEvent, PointerEvent, SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";

const CROP_FRAME_SIZE = 280;
const DEFAULT_ZOOM = 1;
const MAX_ZOOM = 3;
const OUTPUT_SIZE = 1200;

type Point = {
  x: number;
  y: number;
};

type ImageMetrics = {
  naturalWidth: number;
  naturalHeight: number;
};

type DragState = {
  pointerX: number;
  pointerY: number;
  origin: Point;
};

type PhotoCropModalProps = {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getOutputMimeType(type: string) {
  if (type === "image/png" || type === "image/webp") {
    return type;
  }

  return "image/jpeg";
}

function getFileExtension(type: string) {
  if (type === "image/png") {
    return "png";
  }

  if (type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function getDisplayedSize(metrics: ImageMetrics, zoom: number) {
  const baseScale = Math.max(CROP_FRAME_SIZE / metrics.naturalWidth, CROP_FRAME_SIZE / metrics.naturalHeight);
  const scale = baseScale * zoom;

  return {
    scale,
    width: metrics.naturalWidth * scale,
    height: metrics.naturalHeight * scale,
  };
}

function getCenteredOffset(metrics: ImageMetrics, zoom: number) {
  const { width, height } = getDisplayedSize(metrics, zoom);

  return {
    x: (CROP_FRAME_SIZE - width) / 2,
    y: (CROP_FRAME_SIZE - height) / 2,
  };
}

function clampOffset(offset: Point, metrics: ImageMetrics, zoom: number) {
  const { width, height } = getDisplayedSize(metrics, zoom);
  const centeredX = (CROP_FRAME_SIZE - width) / 2;
  const centeredY = (CROP_FRAME_SIZE - height) / 2;

  return {
    x: width <= CROP_FRAME_SIZE ? centeredX : clamp(offset.x, CROP_FRAME_SIZE - width, 0),
    y: height <= CROP_FRAME_SIZE ? centeredY : clamp(offset.y, CROP_FRAME_SIZE - height, 0),
  };
}

function createCroppedFileName(fileName: string, mimeType: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName}.${getFileExtension(mimeType)}`;
}

export function PhotoCropModal({ file, onCancel, onConfirm }: PhotoCropModalProps) {
  const [imageMetrics, setImageMetrics] = useState<ImageMetrics | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const sourceUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isApplying) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isApplying, onCancel]);

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const nextMetrics = {
      naturalWidth: event.currentTarget.naturalWidth,
      naturalHeight: event.currentTarget.naturalHeight,
    };

    setImageMetrics(nextMetrics);
    setZoom(DEFAULT_ZOOM);
    setOffset(getCenteredOffset(nextMetrics, DEFAULT_ZOOM));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!imageMetrics) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerX: event.clientX,
      pointerY: event.clientY,
      origin: offset,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || !imageMetrics) {
      return;
    }

    const nextOffset = clampOffset(
      {
        x: dragState.origin.x + event.clientX - dragState.pointerX,
        y: dragState.origin.y + event.clientY - dragState.pointerY,
      },
      imageMetrics,
      zoom,
    );

    setOffset(nextOffset);
  }

  function handlePointerEnd() {
    setDragState(null);
  }

  function handleZoomChange(event: ChangeEvent<HTMLInputElement>) {
    if (!imageMetrics) {
      return;
    }

    const nextZoom = Number(event.target.value);
    const { scale: currentScale } = getDisplayedSize(imageMetrics, zoom);
    const focusX = (CROP_FRAME_SIZE / 2 - offset.x) / currentScale;
    const focusY = (CROP_FRAME_SIZE / 2 - offset.y) / currentScale;
    const { scale: nextScale } = getDisplayedSize(imageMetrics, nextZoom);

    setZoom(nextZoom);
    setOffset(
      clampOffset(
        {
          x: CROP_FRAME_SIZE / 2 - focusX * nextScale,
          y: CROP_FRAME_SIZE / 2 - focusY * nextScale,
        },
        imageMetrics,
        nextZoom,
      ),
    );
  }

  async function handleApply() {
    if (!sourceUrl || !imageMetrics) {
      return;
    }

    setIsApplying(true);

    try {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();

      const { scale } = getDisplayedSize(imageMetrics, zoom);
      const sourceSize = CROP_FRAME_SIZE / scale;
      const sx = clamp(-offset.x / scale, 0, imageMetrics.naturalWidth - sourceSize);
      const sy = clamp(-offset.y / scale, 0, imageMetrics.naturalHeight - sourceSize);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Не удалось подготовить фото.");
      }

      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const mimeType = getOutputMimeType(file.type);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mimeType, mimeType === "image/jpeg" ? 0.92 : undefined);
      });

      if (!blob) {
        throw new Error("Не удалось обрезать фото.");
      }

      onConfirm(
        new File([blob], createCroppedFileName(file.name, mimeType), {
          type: mimeType,
          lastModified: Date.now(),
        }),
      );
    } finally {
      setIsApplying(false);
    }
  }

  const displayedSize = imageMetrics ? getDisplayedSize(imageMetrics, zoom) : null;

  return (
    <div className="photo-crop-backdrop" role="dialog" aria-modal="true" aria-labelledby="photo_crop_title">
      <div className="photo-crop-modal">
        <div className="photo-crop-header">
          <div>
            <h3 id="photo_crop_title">Обрежьте фотографию</h3>
            <p className="helper-text">Подгоните изображение под квадратную карточку питомца.</p>
          </div>
          <button className="round-action" disabled={isApplying} type="button" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="photo-crop-stage">
          <div
            className={`photo-crop-frame ${dragState ? "dragging" : ""}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            {sourceUrl ? (
              <img
                alt="Обрезка фотографии питомца"
                className="photo-crop-image"
                draggable={false}
                src={sourceUrl}
                style={
                  displayedSize
                    ? {
                        width: `${displayedSize.width}px`,
                        height: `${displayedSize.height}px`,
                        transform: `translate(${offset.x}px, ${offset.y}px)`,
                      }
                    : undefined
                }
                onLoad={handleImageLoad}
              />
            ) : null}
            <div className="photo-crop-overlay" />
          </div>
        </div>

        <label className="photo-crop-slider">
          <span>Масштаб</span>
          <input max={MAX_ZOOM} min={DEFAULT_ZOOM} step="0.01" type="range" value={zoom} onChange={handleZoomChange} />
        </label>

        <div className="photo-crop-actions">
          <button className="secondary-btn" disabled={isApplying} type="button" onClick={onCancel}>
            Отмена
          </button>
          <button className="primary-btn" disabled={!imageMetrics || isApplying} type="button" onClick={() => void handleApply()}>
            {isApplying ? "Готовим фото..." : "Использовать фото"}
          </button>
        </div>
      </div>
    </div>
  );
}
