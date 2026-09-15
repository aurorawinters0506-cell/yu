import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Template } from "@/lib/catalog";

// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PreviewDialog({
  template,
  onOpenChange,
  onDownload,
}: {
  template: Template | null;
  onOpenChange: (open: boolean) => void;
  onDownload: (template: Template, format: "pdf" | "pptx") => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /*
   * Charge et affiche la page PDF actuelle.
   */
  useEffect(() => {
    if (!template?.pdf_url) {
      setPageCount(0);
      setCurrentPage(1);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadPdfPage() {
      setLoading(true);
      setError(null);

      try {
        const loadingTask = pdfjsLib.getDocument({
          url: template!.pdf_url!,
          withCredentials: false,
        });

        const pdf = await loadingTask.promise;

        if (cancelled) {
          return;
        }

        setPageCount(pdf.numPages);

        const pageNumber = Math.min(currentPage, pdf.numPages);
        const page = await pdf.getPage(pageNumber);

        if (cancelled || !canvasRef.current) {
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Impossible de créer le contexte Canvas.");
        }

        /*
         * Taille adaptée à l'écran.
         */
        const containerWidth =
          canvas.parentElement?.clientWidth || 900;

        const baseViewport = page.getViewport({
          scale: 1,
        });

        const scale = Math.min(
          containerWidth / baseViewport.width,
          1.6,
        );

        const viewport = page.getViewport({
          scale,
        });

        const devicePixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(
          viewport.width * devicePixelRatio,
        );

        canvas.height = Math.floor(
          viewport.height * devicePixelRatio,
        );

        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(
          devicePixelRatio,
          0,
          0,
          devicePixelRatio,
          0,
          0,
        );

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error("Erreur PDF Preview:", err);

        setError(
          "Impossible de charger l’aperçu PDF. Vérifiez que le fichier est accessible.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPdfPage();

    return () => {
      cancelled = true;
    };
  }, [template?.pdf_url, currentPage]);

  /*
   * Réinitialisation lorsque l'on ouvre un autre template.
   */
  useEffect(() => {
    if (template) {
      setCurrentPage(1);
      setPageCount(0);
      setError(null);
    }
  }, [template?.template_id]);

  /*
   * Navigation précédente.
   */
  const previousPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  /*
   * Navigation suivante.
   */
  const nextPage = () => {
    setCurrentPage((page) =>
      Math.min(pageCount, page + 1),
    );
  };

  /*
   * Navigation clavier.
   */
  useEffect(() => {
    if (!template) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        previousPage();
      }

      if (event.key === "ArrowRight") {
        nextPage();
      }

      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [template, pageCount]);

  return (
    <Dialog
      open={!!template}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className="
          max-w-6xl
          overflow-hidden
          border-border
          bg-popover
          p-0
        "
      >
        {template && (
          <div className="flex max-h-[90vh] flex-col">
            {/* Header */}
            <DialogHeader className="flex-shrink-0 border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <DialogTitle className="sr-only">
                    PDF Preview
                  </DialogTitle>

                  <DialogDescription>
                    Aperçu du document ·{" "}
                    {pageCount > 0
                      ? `${currentPage} / ${pageCount}`
                      : "Chargement…"}
                  </DialogDescription>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </DialogHeader>

            {/* PDF viewer */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/20 p-4">
              {/* Previous */}
              <Button
                variant="secondary"
                size="icon"
                className="
                  absolute
                  left-3
                  top-1/2
                  z-10
                  -translate-y-1/2
                  rounded-full
                  shadow-lg
                "
                onClick={previousPage}
                disabled={currentPage <= 1 || loading}
                aria-label="Slide précédente"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {/* Slide */}
              <div
                className="
                  flex
                  max-h-[calc(90vh-190px)]
                  w-full
                  items-center
                  justify-center
                  overflow-auto
                  rounded-lg
                "
              >
                {loading && (
                  <div className="flex min-h-[300px] items-center justify-center">
                    <div className="text-sm text-muted-foreground">
                      Chargement de la slide…
                    </div>
                  </div>
                )}

                {error && !loading && (
                  <div className="flex min-h-[300px] max-w-md items-center justify-center text-center text-sm text-destructive">
                    {error}
                  </div>
                )}

                {!error && (
                  <canvas
                    ref={canvasRef}
                    className="
                      max-h-full
                      max-w-full
                      rounded-md
                      bg-white
                      shadow-2xl
                    "
                  />
                )}
              </div>

              {/* Next */}
              <Button
                variant="secondary"
                size="icon"
                className="
                  absolute
                  right-3
                  top-1/2
                  z-10
                  -translate-y-1/2
                  rounded-full
                  shadow-lg
                "
                onClick={nextPage}
                disabled={
                  currentPage >= pageCount ||
                  loading
                }
                aria-label="Slide suivante"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Bottom controls */}
            <div
              className="
                flex
                flex-shrink-0
                flex-wrap
                items-center
                justify-between
                gap-3
                border-t
                border-border
                px-5
                py-4
              "
            >
              {/* Page navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previousPage}
                  disabled={
                    currentPage <= 1 || loading
                  }
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>

                <div className="min-w-[70px] text-center text-sm text-muted-foreground">
                  {pageCount > 0
                    ? `${currentPage} / ${pageCount}`
                    : "—"}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={
                    currentPage >= pageCount ||
                    loading
                  }
                  className="gap-1"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Downloads */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() =>
                    onDownload(template, "pdf")
                  }
                >
                  <Download className="h-4 w-4" />
                  PDF
                </Button>

                <Button
                  className="gap-2"
                  onClick={() =>
                    onDownload(template, "pptx")
                  }
                >
                  <Download className="h-4 w-4" />
                  PPTX
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

