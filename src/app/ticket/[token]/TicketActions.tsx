'use client';

import React, { useState } from 'react';
import { Download, Image as ImageIcon, Printer, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface TicketActionsProps {
  ticketId: string;
  registrationNumber: string;
}

// Utility to wait for all images and web fonts to load with safety timeouts
const waitAllImagesAndFonts = async (element: HTMLElement) => {
  if (typeof window !== 'undefined') {
    // 1. Wait for web fonts (max 1500ms)
    if (document.fonts) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 1500))
        ]);
      } catch (fontErr) {
        console.warn('Font loading check failed, proceeding anyway:', fontErr);
      }
    }
    // 2. Wait for images (max 1500ms per image)
    const images = Array.from(element.querySelectorAll('img'));
    const promises = images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`Image load timed out for: ${img.src}`);
          resolve(null);
        }, 1500);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve(null);
        };
        img.onerror = () => {
          clearTimeout(timeout);
          resolve(null);
        };
      });
    });
    await Promise.all(promises);
  }
};

export default function TicketActions({ ticketId, registrationNumber }: TicketActionsProps) {
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getTicketElement = (): HTMLElement | null => {
    return document.getElementById('event-ticket');
  };

  // 1. Download Ticket as Image (PNG)
  const downloadImage = async () => {
    const element = getTicketElement();
    if (!element) return;

    setDownloadingImage(true);
    setErrorMessage(null);
    try {
      // Wait for fonts & QR image to load
      await waitAllImagesAndFonts(element);

      const canvas = await html2canvas(element, {
        scale: 3, // High resolution (3x)
        useCORS: true,
        allowTaint: false, // Must be false to prevent security error on toDataURL
        backgroundColor: '#0c0724', // deep navy purple matching element background
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `ALGO-RHYTHM-Ticket-${registrationNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      console.error('Image export failed:', err);
      setErrorMessage(`Image download failed: ${err.message || String(err)}. Please try taking a screenshot.`);
      throw err; // Do not silently catch
    } finally {
      setDownloadingImage(false);
    }
  };

  // 2. Download Ticket as PDF
  const downloadPdf = async () => {
    const element = getTicketElement();
    if (!element) return;

    setDownloadingPdf(true);
    setErrorMessage(null);
    try {
      // Wait for fonts & QR image to load
      await waitAllImagesAndFonts(element);

      const canvas = await html2canvas(element, {
        scale: 3, // Match high resolution
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0c0724',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');

      // Create PDF matching the high-quality canvas dimensions exactly in points
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`ALGO-RHYTHM-Ticket-${registrationNumber}.pdf`);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      setErrorMessage(`PDF download failed: ${err.message || String(err)}. Please try downloading as an image.`);
      throw err; // Do not silently catch
    } finally {
      setDownloadingPdf(false);
    }
  };

  // 3. Trigger Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-4">
      {/* Error message indicator */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold animate-pulse">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
        {/* PDF */}
        <button
          onClick={downloadPdf}
          disabled={downloadingPdf || downloadingImage}
          className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-[#a855f7]/15 border border-[#a855f7]/30 hover:bg-[#a855f7]/25 text-purple-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
        >
          {downloadingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download PDF
            </>
          )}
        </button>

        {/* Image */}
        <button
          onClick={downloadImage}
          disabled={downloadingPdf || downloadingImage}
          className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-[#ec4899]/15 border border-[#ec4899]/30 hover:bg-[#ec4899]/25 text-pink-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
        >
          {downloadingImage ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Image...
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              Download Image
            </>
          )}
        </button>

        {/* Print */}
        <button
          onClick={handlePrint}
          disabled={downloadingPdf || downloadingImage}
          className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print Ticket
        </button>
      </div>

      {/* Navigation options */}
      <div className="text-center pt-2 print:hidden">
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-slate-200 font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}
