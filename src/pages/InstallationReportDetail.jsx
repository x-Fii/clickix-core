import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil, CheckCircle, FileText, Package, PackageMinus, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  scheduled:  { label: 'Scheduled',  className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  completed:  { label: 'Completed',  className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  billed:     { label: 'Billed',     className: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  cancelled:  { label: 'Cancelled',  className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const TYPE_CONFIG = {
  commissioning:    { label: 'Commission',   className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  decommissioning:  { label: 'Decommission', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
};

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export default function InstallationReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pdfRef = useRef(null);
  const [exportingPdf, setExportingPdf] = useState(false);

    const handleExportPdf = async () => {
    if (!pdfRef.current) return;

    setExportingPdf(true);

    const wrapper = pdfRef.current;

    try {
      /*
      * Wait for all IR photos, signature and company stamp.
      */
      const pdfImages = Array.from(
        wrapper.querySelectorAll('img')
      );

      await Promise.all(
        pdfImages.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }

              img.onload = resolve;
              img.onerror = resolve;
            })
        )
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 300)
      );

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const sideMargin = 10;
      const topMargin = 10;
      const bottomMargin = 12;
      const blockGap = 3;

      const headerHeight = 22;
      const footerHeight = 8;

      const footerSafetyGap = 6;
      const paginationSafetyGap = 8;

      const contentWidth =
        pageWidth - sideMargin * 2;

      const contentTop =
        topMargin + headerHeight + 4;

      const contentBottom =
        pageHeight -
        bottomMargin -
        footerHeight -
        footerSafetyGap;

      const availableContentHeight =
        contentBottom - contentTop;

      /*
      * IR template structure:
      *
      * child 0 = blue header
      * child 1 = main IR content
      * child 2 = old footer
      */
      const headerElement =
        wrapper.children[0];

      const mainContent =
        wrapper.children[1];

      if (!headerElement || !mainContent) {
        throw new Error(
          'Installation Report PDF template is incomplete'
        );
      }

      /*
      * Capture the IR header once.
      * It will be repeated on every PDF page.
      */
      const headerCanvas =
        await html2canvas(headerElement, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#2563eb',
          logging: false,
          windowWidth: 794
        });

      const headerImageData =
        headerCanvas.toDataURL(
          'image/jpeg',
          0.95
        );

      let renderedHeaderHeight =
        (headerCanvas.height * pageWidth) /
        headerCanvas.width;

      renderedHeaderHeight = Math.min(
        renderedHeaderHeight,
        headerHeight
      );

      /*
      * Every direct child inside the main IR content
      * is treated as a top-level PDF section.
      */
      const contentBlocks = Array.from(
        mainContent.children
      ).filter(
        (child) => child.offsetHeight > 1
      );

      if (contentBlocks.length === 0) {
        throw new Error(
          'No Installation Report content found'
        );
      }

      let currentY = contentTop;
      let pageHasContent = false;

      const drawHeader = () => {
        pdf.addImage(
          headerImageData,
          'JPEG',
          0,
          0,
          pageWidth,
          renderedHeaderHeight
        );
      };

      const startNewPage = () => {
        pdf.addPage();

        drawHeader();

        currentY = contentTop;
        pageHasContent = false;
      };

      const drawAllFooters = () => {
        const totalPages =
          pdf.internal.getNumberOfPages();

        for (
          let pageNumber = 1;
          pageNumber <= totalPages;
          pageNumber += 1
        ) {
          pdf.setPage(pageNumber);

          const footerY =
            pageHeight - bottomMargin + 2;

          pdf.setDrawColor(229, 231, 235);

          pdf.line(
            sideMargin,
            footerY - 5,
            pageWidth - sideMargin,
            footerY - 5
          );

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(156, 163, 175);

          pdf.text(
            `Page ${pageNumber} of ${totalPages} | Installation Report`,
            sideMargin,
            footerY
          );

          pdf.text(
            String(report.report_number || ''),
            pageWidth - sideMargin,
            footerY,
            {
              align: 'right'
            }
          );
        }
      };

      /*
      * Capture one IR element.
      *
      * The temporary bottom padding prevents
      * html2canvas from cutting the final text line.
      */
      const renderElement = async (element) => {
        const originalPaddingBottom =
          element.style.paddingBottom;

        const originalOverflow =
          element.style.overflow;

        const currentPaddingBottom =
          parseFloat(
            window
              .getComputedStyle(element)
              .paddingBottom
          ) || 0;

        element.style.paddingBottom =
          `${currentPaddingBottom + 6}px`;

        element.style.overflow = 'visible';

        try {
          return await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 794
          });
        } finally {
          element.style.paddingBottom =
            originalPaddingBottom;

          element.style.overflow =
            originalOverflow;
        }
      };

      /*
      * Add one complete canvas block to the PDF.
      *
      * If it does not fit, move the complete block
      * to the next page instead of cutting it.
      */
      const addCanvasToPDF = (canvas) => {
        const imageData =
          canvas.toDataURL(
            'image/jpeg',
            0.95
          );

        let renderWidth = contentWidth;

        let renderHeight =
          (canvas.height * renderWidth) /
          canvas.width;

        const safePageHeight =
          availableContentHeight -
          paginationSafetyGap;

        /*
        * Last protection for a block that cannot
        * be divided any further.
        */
        if (renderHeight > safePageHeight) {
          const scaleRatio =
            safePageHeight / renderHeight;

          renderHeight *= scaleRatio;
          renderWidth *= scaleRatio;
        }

        const remainingHeight =
          contentBottom -
          currentY -
          paginationSafetyGap;

        if (
          renderHeight > remainingHeight &&
          pageHasContent
        ) {
          startNewPage();
        }

        const x =
          sideMargin +
          Math.max(
            0,
            (contentWidth - renderWidth) / 2
          );

        pdf.addImage(
          imageData,
          'JPEG',
          x,
          currentY,
          renderWidth,
          renderHeight
        );

        currentY +=
          renderHeight + blockGap;

        pageHasContent = true;
      };

      const addPhotoContainerWithPagination =
        async (photoContainer) => {
          const imageElements = Array.from(
            photoContainer.children
          ).filter(
            (child) => child.tagName === 'IMG'
          );

          if (imageElements.length === 0) {
            return;
          }

          const imagesPerRow = 3;

          for (
            let index = 0;
            index < imageElements.length;
            index += imagesPerRow
          ) {
            const temporaryRow =
              document.createElement('div');

            const containerWidth =
              photoContainer
                .getBoundingClientRect()
                .width ||
              photoContainer.offsetWidth ||
              730;

            Object.assign(
              temporaryRow.style,
              {
                position: 'fixed',
                left: '-10000px',
                top: '0',
                width: `${containerWidth}px`,
                display: 'grid',
                gridTemplateColumns:
                  'repeat(3, minmax(0, 1fr))',
                gap: '8px',
                backgroundColor: '#ffffff'
              }
            );

            const rowImages =
              imageElements.slice(
                index,
                index + imagesPerRow
              );

            rowImages.forEach((image) => {
              const clone =
                image.cloneNode(true);

              Object.assign(clone.style, {
                width: '100%',
                height: '180px',
                maxHeight: '180px',
                objectFit: 'contain',
                border:
                  '1px solid #e5e7eb',
                borderRadius: '4px',
                backgroundColor: '#ffffff',
                display: 'block'
              });

              temporaryRow.appendChild(clone);
            });

            wrapper.appendChild(temporaryRow);

            const clonedImages =
              Array.from(
                temporaryRow.querySelectorAll(
                  'img'
                )
              );

            await Promise.all(
              clonedImages.map(
                (img) =>
                  new Promise((resolve) => {
                    if (img.complete) {
                      resolve();
                      return;
                    }

                    img.onload = resolve;
                    img.onerror = resolve;
                  })
              )
            );

            const rowCanvas =
              await renderElement(
                temporaryRow
              );

            temporaryRow.remove();

            addCanvasToPDF(rowCanvas);
          }
        };

      /*
      * Add an IR element using the same recursive
      * pagination logic used by the Service Report.
      */
      const addElementWithPagination =
        async (element, depth = 0) => {
          if (
            !element ||
            element.offsetHeight < 2
          ) {
            return;
          }

          const directChildren =
            Array.from(element.children);

          const computedStyle =
            window.getComputedStyle(element);

          const directImages =
            directChildren.filter(
              (child) =>
                child.tagName === 'IMG'
            );

          /*
          * IR currently uses flex photo containers,
          * while SR mainly uses grid containers.
          *
          * Support both.
          */
          const isPhotoContainer =
            directChildren.length > 0 &&
            directImages.length ===
              directChildren.length &&
            (
              computedStyle.display ===
                'flex' ||
              computedStyle.display ===
                'grid'
            );

          if (isPhotoContainer) {
            await addPhotoContainerWithPagination(
              element
            );

            return;
          }

          /*
          * Check whether this section contains
          * a direct photo container.
          *
          * Such a section must be split so that
          * its text can use the current page space
          * while photos can continue on later pages.
          */
          const containsPhotoContainer =
            directChildren.some((child) => {
              const childStyle =
                window.getComputedStyle(child);

              const grandchildren =
                Array.from(child.children);

              return (
                grandchildren.length > 0 &&
                grandchildren.every(
                  (grandchild) =>
                    grandchild.tagName === 'IMG'
                ) &&
                (
                  childStyle.display ===
                    'flex' ||
                  childStyle.display ===
                    'grid'
                )
              );
            });

          const canvas =
            await renderElement(element);

          const estimatedHeight =
            (canvas.height * contentWidth) /
            canvas.width;

          /*
          * A normal section that fits on one page
          * can be added as one complete block.
          *
          * Sections containing photos continue
          * downward so they can be separated.
          */
          if (
            !containsPhotoContainer &&
            estimatedHeight <=
              availableContentHeight -
                paginationSafetyGap
          ) {
            addCanvasToPDF(canvas);
            return;
          }

          const childElements =
            directChildren.filter(
              (child) =>
                child.offsetHeight > 1
            );

          const keepTogether =
            element.dataset
              .pdfKeepTogether === 'true';

          const cannotSplitFurther =
            keepTogether ||
            childElements.length === 0 ||
            depth >= 7 ||
            element.tagName === 'TABLE' ||
            element.tagName === 'IMG';

          if (cannotSplitFurther) {
            addCanvasToPDF(canvas);
            return;
          }

          for (
            let index = 0;
            index < childElements.length;
            index += 1
          ) {
            const child =
              childElements[index];

            const childCanvas =
              await renderElement(child);

            const childHeight =
              (
                childCanvas.height *
                contentWidth
              ) / childCanvas.width;

            const remainingHeight =
              contentBottom -
              currentY -
              paginationSafetyGap;

            /*
            * Prevent a short blue heading from being
            * left alone at the bottom of a page.
            */
            const isShortHeading =
              childHeight < 18 &&
              index <
                childElements.length - 1;

            if (
              isShortHeading &&
              remainingHeight < 45 &&
              pageHasContent
            ) {
              startNewPage();
            }

            await addElementWithPagination(
              child,
              depth + 1
            );
          }
        };

      /*
      * Draw the first IR header.
      */
      drawHeader();

      /*
      * Add every IR section in its original order.
      */
      for (const block of contentBlocks) {
        await addElementWithPagination(block);
      }

      /*
      * Add accurate page numbers after pagination.
      */
      drawAllFooters();

      pdf.save(
        `${report.report_number || 'installation-report'}.pdf`
      );

      toast({
        title: 'PDF exported'
      });
    } catch (error) {
      console.error(
        'Installation PDF export failed:',
        error
      );

      toast({
        title: 'Failed to export PDF',
        variant: 'destructive'
      });
    } finally {
      setExportingPdf(false);
    }
  };



  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['installation-report', id],
    queryFn: () => base44.entities.InstallationReport.filter({ id }),
  });
  const report = reports[0];

  const markCompleteMutation = useMutation({
    mutationFn: () => base44.entities.InstallationReport.update(id, {
      status: 'completed',
      submitted: true,
      submitted_at: new Date().toISOString(),
      ack_timestamp: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['installation-report', id]);
      queryClient.invalidateQueries(['installation-reports']);
      toast({ title: 'Report marked as completed' });
    },
    onError: (err) => toast({ title: 'Failed to mark complete', description: err?.message || 'Please try again.', variant: 'destructive' }),
  });

  const markBilledMutation = useMutation({
    mutationFn: () => base44.entities.InstallationReport.update(id, { status: 'billed' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['installation-report', id]);
      queryClient.invalidateQueries(['installation-reports']);
      toast({ title: 'Report marked as billed' });
    },
    onError: (err) => toast({ title: 'Failed to mark billed', description: err?.message || 'Please try again.', variant: 'destructive' }),
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!report) return (
    <div className="p-6 text-center text-muted-foreground">Report not found.</div>
  );

  const sc = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
  const tc = TYPE_CONFIG[report.report_type] || TYPE_CONFIG.commissioning;
  const equipmentSections = report.report_type === 'commissioning' ? (report.equipment_sections || []) : [];
  const decommissionSections = report.report_type === 'decommissioning' ? (report.decommission_sections || report.equipment_decommissioned?.map(item => ({ section_name: '', items: [item] })) || []) : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/installation')}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold font-heading font-mono">{report.report_number}</h1>
              <Badge variant="outline" className={`text-[10px] ${tc.className}`}>{tc.label}</Badge>
              <Badge variant="outline" className={`text-[10px] ${sc.className}`}>{sc.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Created {new Date(report.created_date).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report.status !== 'completed' && report.status !== 'cancelled' && report.status !== 'billed' && (
            <Button variant="outline" size="sm" onClick={() => markCompleteMutation.mutate()} disabled={markCompleteMutation.isPending}>
              <CheckCircle size={14} className="mr-1" /> Mark Complete
            </Button>
          )}
          {report.status === 'completed' && (
            <Button variant="outline" size="sm" onClick={() => markBilledMutation.mutate()} disabled={markBilledMutation.isPending}>
              <CheckCircle size={14} className="mr-1" /> Mark Billed
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
            <Download size={14} className="mr-1" /> {exportingPdf ? 'Exporting…' : 'Export PDF'}
          </Button>
          <Button size="sm" asChild>
            <Link to={`/installation/${id}/edit`}><Pencil size={14} className="mr-1" /> Edit</Link>
          </Button>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Client & Site */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Client & Site</h2>
          <Field label="Client" value={report.client_name} />
          <Field label="Site / Outlet" value={report.site_name} />
          <Field label="Location" value={report.site_location} />
          <Field label="Site PIC" value={report.site_pic_name} />
        </div>

        {/* Schedule */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Schedule & Attendance</h2>
          <Field label="Scheduled Date" value={report.scheduled_date} />
          <Field label="Installation Date" value={report.installation_date} />
          <Field label="Installation Finish Date" value={report.installation_finish_date} />
          <Field label="Attend Time" value={report.attend_time} />
          {report.ack_timestamp && <Field label="Completed At" value={new Date(report.ack_timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} />}
          <Field label="Technician" value={report.attended_staff_name} />
          <Field label="DO Number" value={report.do_number} />
          <Field label="Work Order No." value={report.work_order_number} />
          <Field label="Reported By" value={report.reported_by} />
        </div>
      </div>

      {/* Equipment Installed — sectioned (commissioning) */}
      {equipmentSections.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Package size={14} /> Equipment Installed
          </h2>
          {equipmentSections.map((sec, si) => (
            <div key={si} className="border border-primary/20 rounded-lg p-4 space-y-3 bg-muted/10">
              <p className="text-sm font-semibold text-primary">{sec.section_name || `Section ${si + 1}`}</p>
              <div className="space-y-3 pl-2 border-l-2 border-border">
                {(sec.items || []).map((item, ii) => (
                  <div key={ii} className="border border-border rounded-lg p-3 bg-card space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <Field label="Device Type" value={item.device_type} />
                      <Field label="Device Name" value={item.device_name} />
                      <Field label="Serial Number" value={item.serial_number} />
                      <Field label="Model" value={item.model} />
                      <Field label="SKU" value={item.sku} />
                      <Field label="Anydesk" value={item.anydesk} />
                      <Field label="Length" value={item.length} />
                      <Field label="Quantity" value={item.quantity} />
                      <Field label="Number of Ports" value={item.num_ports} />
                      <Field label="Number of Gang" value={item.num_gang} />
                      <Field label="Notes" value={item.notes} />
                    </div>
                    {item.photos && item.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.photos.map((url, pi) => (
                          <a key={pi} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="" className="w-20 h-20 object-cover rounded border border-border hover:opacity-80 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Equipment Decommissioned — section-based */}
      {decommissionSections.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <PackageMinus size={14} /> Equipment Decommissioned
          </h2>
          {decommissionSections.map((sec, si) => (
            <div key={si} className="border border-primary/20 rounded-lg p-4 space-y-3 bg-muted/10">
              {sec.section_name && <p className="text-sm font-semibold text-primary">{sec.section_name}</p>}
              <div className="space-y-3 pl-2 border-l-2 border-border">
                {(sec.items || []).map((item, ii) => (
                  <div key={ii} className="border border-border rounded-lg p-3 bg-card space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <Field label="Device Type" value={item.device_type} />
                      <Field label="Device Name" value={item.device_name} />
                      <Field label="Serial Number" value={item.serial_number} />
                      {item.reason_for_decommission && <Field label="Reason" value={item.reason_for_decommission} />}
                    </div>
                    {item.photos && item.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.photos.map((url, pi) => (
                          <a key={pi} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="" className="w-20 h-20 object-cover rounded border border-border hover:opacity-80 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pre-Job Site Assessment */}
      {(report.pre_job_assessment || (report.pre_job_assessment_photos && report.pre_job_assessment_photos.length > 0)) && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Pre-Job Site Assessment</h2>
          {report.pre_job_assessment && <p className="text-sm whitespace-pre-wrap">{report.pre_job_assessment}</p>}
          {report.pre_job_assessment_photos && report.pre_job_assessment_photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.pre_job_assessment_photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded border border-border hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post Job Technician Note */}
      {report.technician_notes && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Post Job Technician Note</h2>
          <p className="text-sm whitespace-pre-wrap">{report.technician_notes}</p>
        </div>
      )}

      {/* Acknowledgement */}
      {(report.ack_name || report.ack_phone || report.ack_signature) && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Acknowledgement</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={report.ack_name} />
            <Field label="Phone" value={report.ack_phone} />
          </div>
          {report.ack_timestamp && <Field label="Timestamp" value={new Date(report.ack_timestamp).toLocaleString()} />}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.ack_signature && (
              <div>
                <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1">Signature</p>
                <img src={report.ack_signature} alt="Signature" className="max-w-xs h-24 object-contain border border-border rounded bg-white p-1" />
              </div>
            )}
            {report.ack_company_stamp && (
              <div>
                <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1">Company Stamp</p>
                <img src={report.ack_company_stamp} alt="Company Stamp" className="max-w-xs h-24 object-contain border border-border rounded bg-white p-1" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supporting Photos */}
      {report.supporting_photos && report.supporting_photos.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Package size={14} /> Supporting Photos
          </h2>
          <div className="flex flex-wrap gap-3">
            {report.supporting_photos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Photo ${i + 1}`} className="w-28 h-28 object-cover rounded border border-border hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Supporting Documents */}
      {report.supporting_documents && report.supporting_documents.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-2">
          <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText size={14} /> Supporting Documents
          </h2>
          <div className="space-y-1">
            {report.supporting_documents.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="block text-xs text-primary hover:underline">
                Document {i + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Hidden PDF Template */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px', background: '#fff', color: '#111827', fontFamily: 'Arial, sans-serif', fontSize: '12px' }} ref={pdfRef}>
        {/* Header */}
        <div style={{ background: '#2563eb', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.5px' }}>CLICK IX SDN BHD</div>
            <div style={{ fontSize: '11px', color: '#bfdbfe', marginTop: '2px' }}>INSTALLATION REPORT</div>
            <div style={{ fontSize: '10px', color: '#bfdbfe', marginTop: '2px', fontFamily: 'monospace' }}>{report.report_number}</div>
          </div>
          <div style={{ textAlign: 'right', color: '#bfdbfe', fontSize: '10px' }}>
            Generated: {new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' })}, {new Date().toLocaleTimeString()}
          </div>
        </div>

        <div style={{ padding: '24px 32px' }}>
          {/* Job Information */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Job Information</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {[['TECHNICIAN', report.attended_staff_name], ['TECHNICIAN EMAIL', report.attended_staff_email], ['STORE', report.site_name], ['LOCATION', report.site_location], ['DO NUMBER', report.do_number], ['WORK ORDER NUMBER', report.work_order_number], ['SITE PIC', report.site_pic_name], ['REPORTED BY', report.reported_by], ['CLIENT', report.client_name], ['REPORT TYPE', tc.label]].filter(([,v]) => v).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontSize: '12px', color: '#111827' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule & Attendance */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Schedule & Attendance</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {[['SCHEDULED DATE', report.scheduled_date], ['INSTALLATION DATE', report.installation_date], ['INSTALLATION FINISH DATE', report.installation_finish_date], ['ATTEND TIME', report.attend_time], ['STATUS', sc.label]].filter(([,v]) => v).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{k}</div>
                  <div style={{ fontSize: '12px', color: '#111827' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Equipment Installed — sectioned (commissioning) */}
          {equipmentSections.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Equipment Installed</span>
              </div>
              {equipmentSections.map((sec, si) => (
                <div key={si} style={{ marginBottom: '16px' }}>
                  <div style={{ background: '#f0f9ff', borderLeft: '3px solid #60a5fa', padding: '5px 10px', marginBottom: '8px', fontWeight: '700', fontSize: '11px', color: '#1d4ed8' }}>
                    {sec.section_name || `Section ${si + 1}`}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>#</th>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Device Type</th>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Device Name</th>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Serial Number</th>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Specifications</th>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sec.items || []).map((item, ii) => {
                        const specs = [
                          item.model && `Model: ${item.model}`,
                          item.sku && `SKU: ${item.sku}`,
                          item.anydesk && `Anydesk: ${item.anydesk}`,
                          item.length && `Length: ${item.length}`,
                          (item.quantity != null && item.quantity !== '') && `Qty: ${item.quantity}`,
                          (item.num_ports != null && item.num_ports !== '') && `Ports: ${item.num_ports}`,
                          (item.num_gang != null && item.num_gang !== '') && `Gang: ${item.num_gang}`,
                        ].filter(Boolean).join('\n');
                        return (
                        <tr key={ii} style={{ background: ii % 2 === 0 ? '#fff' : '#f9fafb' }}>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb' }}>{ii + 1}</td>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb' }}>{item.device_type}</td>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb' }}>{item.device_name}</td>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb', fontFamily: 'monospace' }}>{item.serial_number}</td>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb', whiteSpace: 'pre-line', fontSize: '10px', color: '#374151' }}>{specs || '—'}</td>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb' }}>{item.notes}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(sec.items || []).some(item => item.photos && item.photos.length > 0) && (
                    <div style={{ marginTop: '10px' }}>
                      {sec.items.map((item, ii) => item.photos && item.photos.length > 0 && (
                        <div key={ii} style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '5px', fontWeight: '600' }}>{item.device_name} Photos:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {item.photos.map((url, pi) => (
                              <img key={pi} src={url} alt="" crossOrigin="anonymous" style={{
                                                                                                width: '145px',
                                                                                                height: 'auto',
                                                                                                maxHeight: '180px',
                                                                                                objectFit: 'contain',
                                                                                                border: '1px solid #e5e7eb',
                                                                                                borderRadius: '4px',
                                                                                                background: '#ffffff',
                                                                                                display: 'block'
                                                                                            }} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Equipment Decommissioned — section-based */}
          {decommissionSections.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Equipment Decommissioned</span>
              </div>
              {decommissionSections.map((sec, si) => (
                <div key={si} style={{ marginBottom: '16px' }}>
                  {sec.section_name && (
                    <div style={{ background: '#f0f9ff', borderLeft: '3px solid #60a5fa', padding: '5px 10px', marginBottom: '8px', fontWeight: '700', fontSize: '11px', color: '#1d4ed8' }}>
                      {sec.section_name}
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>#</th>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Device Type</th>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Device Name / Model</th>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Serial Number</th>
                        <th style={{ padding: '7px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sec.items || []).map((item, ii) => (
                        <tr key={ii} style={{ background: ii % 2 === 0 ? '#fff' : '#f9fafb' }}>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb' }}>{ii + 1}</td>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb' }}>{item.device_type}</td>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb' }}>{item.device_name}</td>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb', fontFamily: 'monospace' }}>{item.serial_number}</td>
                          <td style={{ padding: '7px', border: '1px solid #e5e7eb' }}>{item.reason_for_decommission}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(sec.items || []).some(item => item.photos && item.photos.length > 0) && (
                    <div style={{ marginTop: '10px' }}>
                      {sec.items.map((item, ii) => item.photos && item.photos.length > 0 && (
                        <div key={ii} style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '5px', fontWeight: '600' }}>{item.device_name} Photos:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {item.photos.map((url, pi) => (
                              <img key={pi} src={url} alt="" crossOrigin="anonymous" style={{
                                                                                                width: '145px',
                                                                                                height: 'auto',
                                                                                                maxHeight: '180px',
                                                                                                objectFit: 'contain',
                                                                                                border: '1px solid #e5e7eb',
                                                                                                borderRadius: '4px',
                                                                                                background: '#ffffff',
                                                                                                display: 'block'
                                                                                            }} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pre-Job Site Assessment */}
          {(report.pre_job_assessment || (report.pre_job_assessment_photos && report.pre_job_assessment_photos.length > 0)) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Pre-Job Site Assessment</span>
              </div>
              {report.pre_job_assessment && <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', padding: '12px', background: '#f9fafb', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '12px', marginBottom: '10px' }}>{report.pre_job_assessment}</div>}
              {report.pre_job_assessment_photos && report.pre_job_assessment_photos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {report.pre_job_assessment_photos.map((url, i) => (
                    <img key={i} src={url} alt="" crossOrigin="anonymous" style={{
                                                                                  width: '145px',
                                                                                  height: 'auto',
                                                                                  maxHeight: '180px',
                                                                                  objectFit: 'contain',
                                                                                  border: '1px solid #e5e7eb',
                                                                                  borderRadius: '4px',
                                                                                  background: '#ffffff',
                                                                                  display: 'block'
                                                                                }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Post Job Technician Note */}
          {report.technician_notes && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Post Job Technician Note</span>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', padding: '12px', background: '#f9fafb', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '12px' }}>{report.technician_notes}</div>
            </div>
          )}

          {/* Supporting Photos */}
          {report.supporting_photos && report.supporting_photos.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Photo Evidence</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {report.supporting_photos.map((url, i) => (
                  <img key={i} src={url} alt="" crossOrigin="anonymous" style={{
                                                                                width: '145px',
                                                                                height: 'auto',
                                                                                maxHeight: '180px',
                                                                                objectFit: 'contain',
                                                                                border: '1px solid #e5e7eb',
                                                                                borderRadius: '4px',
                                                                                background: '#ffffff',
                                                                                display: 'block'
                                                                              }} />
                ))}
              </div>
            </div>
          )}

          {/* Client Signature */}
          {(report.ack_name || report.ack_phone || report.ack_signature) && (
            
            <div 
            data-pdf-keep-together="true"
            style={{ marginTop: '24px' }}>
              <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '6px 12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>Client Signature</span>
              </div>
              {report.ack_signature
                ? <img src={report.ack_signature} alt="sig" crossOrigin="anonymous" style={{ maxHeight: '100px', maxWidth: '220px', display: 'block', marginBottom: '12px' }} />
                : <div style={{ border: '1px solid #e5e7eb', height: '70px', width: '220px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '10px', marginBottom: '12px' }}>No signature captured</div>
              }
              <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Name:</strong> {report.ack_name}</div>
              <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Phone:</strong> {report.ack_phone}</div>
              {report.ack_timestamp && <div style={{ fontSize: '12px', color: '#6b7280' }}>Signed on: {new Date(report.ack_timestamp).toLocaleString()}</div>}
              {report.ack_company_stamp && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>COMPANY STAMP</div>
                  <img src={report.ack_company_stamp} alt="stamp" crossOrigin="anonymous" style={{ maxWidth: '200px', maxHeight: '120px', objectFit: 'contain' }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 32px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9ca3af' }}>
          <span>Page 1 of 1 | Installation Report</span>
          <span>{report.report_number}</span>
        </div>
      </div>
    </div>
  );
}