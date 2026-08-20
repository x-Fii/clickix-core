import { useState, useRef } from 'react';
import {
  Navigate,
  useParams,
  useNavigate
} from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';

import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  ArrowLeft,
  FileText,
  Package,
  PackageMinus,
  Download
} from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';


const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    className:
      'bg-slate-500/20 text-slate-300 border-slate-500/30'
  },

  scheduled: {
    label: 'Scheduled',
    className:
      'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },

  completed: {
    label: 'Completed',
    className:
      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },

  billed: {
    label: 'Billed',
    className:
      'bg-pink-500/20 text-pink-300 border-pink-500/30'
  },

  cancelled: {
    label: 'Cancelled',
    className:
      'bg-red-500/20 text-red-300 border-red-500/30'
  }
};


const TYPE_CONFIG = {
  commissioning: {
    label: 'Commission',
    className:
      'bg-purple-500/20 text-purple-300 border-purple-500/30'
  },

  decommissioning: {
    label: 'Decommission',
    className:
      'bg-orange-500/20 text-orange-300 border-orange-500/30'
  }
};


function Field({ label, value }) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  return (
    <div>
      <p className="
        text-[10px]
        font-mono
        font-semibold
        text-muted-foreground
        uppercase
        tracking-wider
        mb-0.5
      ">
        {label}
      </p>

      <p className="text-sm whitespace-pre-wrap">
        {String(value)}
      </p>
    </div>
  );
}


export default function InstallationPDFTestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { toast } = useToast();

  const {
    user,
    isLoadingAuth
  } = useAuth();

  const pdfRef = useRef(null);

  const [
    exportingPdf,
    setExportingPdf
  ] = useState(false);


  const isPDFTester =
    user?.email?.toLowerCase() ===
    'bianca@click-ix.com';


  /*
   * READ ONLY.
   *
   * This reads the same real InstallationReport
   * record as the production Installation detail.
   *
   * It does NOT update the report.
   */
  const {
    data: reports = [],
    isLoading
  } = useQuery({
    queryKey: [
      'installation-report-pdf-test',
      id
    ],

    queryFn: () =>
      base44.entities.InstallationReport.filter({
        id
      }),

    enabled:
      !isLoadingAuth &&
      isPDFTester &&
      !!id
  });


  const report = reports[0];


  /*
   * TEST PDF EXPORT
   *
   * For now this intentionally keeps the
   * production html2canvas + jsPDF method.
   *
   * This gives us a baseline.
   *
   * Later you can replace ONLY this function
   * to test another PDF engine.
   */
  const handleExportPdf = async () => {
    if (
      !pdfRef.current ||
      !report
    ) {
      return;
    }

    setExportingPdf(true);

    const wrapper =
      pdfRef.current;

    try {
      /*
       * Wait for all:
       * - equipment photos
       * - supporting photos
       * - delivery photos
       * - signature
       * - company stamp
       */
      const pdfImages =
        Array.from(
          wrapper.querySelectorAll('img')
        );

      await Promise.all(
        pdfImages.map(
          (img) =>
            new Promise(
              (resolve) => {
                if (img.complete) {
                  resolve();
                  return;
                }

                img.onload = resolve;
                img.onerror = resolve;
              }
            )
        )
      );


      /*
       * Small safety wait after images load.
       */
      await new Promise(
        (resolve) =>
          setTimeout(resolve, 300)
      );


      const pdf =
        new jsPDF({
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
        pageWidth -
        sideMargin * 2;


      const contentTop =
        topMargin +
        headerHeight +
        4;


      const contentBottom =
        pageHeight -
        bottomMargin -
        footerHeight -
        footerSafetyGap;


      const availableContentHeight =
        contentBottom -
        contentTop;


      /*
       * Hidden template structure:
       *
       * child 0 = blue header
       * child 1 = main content
       * child 2 = old footer
       */
      const headerElement =
        wrapper.children[0];

      const mainContent =
        wrapper.children[1];


      if (
        !headerElement ||
        !mainContent
      ) {
        throw new Error(
          'Installation Report PDF template is incomplete'
        );
      }


      /*
       * Capture header once.
       *
       * We reuse the header image
       * on every PDF page.
       */
      const headerCanvas =
        await html2canvas(
          headerElement,
          {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor:
              '#2563eb',
            logging: false,
            windowWidth: 794
          }
        );


      const headerImageData =
        headerCanvas.toDataURL(
          'image/jpeg',
          0.95
        );


      let renderedHeaderHeight =
        (
          headerCanvas.height *
          pageWidth
        ) /
        headerCanvas.width;


      renderedHeaderHeight =
        Math.min(
          renderedHeaderHeight,
          headerHeight
        );


      /*
       * Every direct child in main content
       * becomes one top-level PDF block.
       */
      const contentBlocks =
        Array.from(
          mainContent.children
        ).filter(
          (child) =>
            child.offsetHeight > 1
        );


      if (
        contentBlocks.length === 0
      ) {
        throw new Error(
          'No Installation Report content found'
        );
      }


      let currentY =
        contentTop;

      let pageHasContent =
        false;


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

        currentY =
          contentTop;

        pageHasContent =
          false;
      };


      const drawAllFooters = () => {
        const totalPages =
          pdf.internal.getNumberOfPages();


        for (
          let pageNumber = 1;
          pageNumber <= totalPages;
          pageNumber += 1
        ) {
          pdf.setPage(
            pageNumber
          );


          const footerY =
            pageHeight -
            bottomMargin +
            2;


          pdf.setDrawColor(
            229,
            231,
            235
          );


          pdf.line(
            sideMargin,
            footerY - 5,
            pageWidth -
              sideMargin,
            footerY - 5
          );


          pdf.setFont(
            'helvetica',
            'normal'
          );

          pdf.setFontSize(8);

          pdf.setTextColor(
            156,
            163,
            175
          );


          pdf.text(
            `Page ${pageNumber} of ${totalPages} | Installation Report`,
            sideMargin,
            footerY
          );


          pdf.text(
            String(
              report.report_number ||
              ''
            ),
            pageWidth -
              sideMargin,
            footerY,
            {
              align: 'right'
            }
          );
        }
      };


      /*
       * Render one HTML element.
       */
      const renderElement =
        async (element) => {
          const originalPaddingBottom =
            element.style
              .paddingBottom;


          const originalOverflow =
            element.style
              .overflow;


          const currentPaddingBottom =
            parseFloat(
              window
                .getComputedStyle(
                  element
                )
                .paddingBottom
            ) || 0;


          /*
           * Prevent final line
           * from being cut.
           */
          element.style.paddingBottom =
            `${
              currentPaddingBottom +
              6
            }px`;


          element.style.overflow =
            'visible';


          try {
            return await html2canvas(
              element,
              {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor:
                  '#ffffff',
                logging: false,
                windowWidth: 794
              }
            );
          } finally {
            element.style.paddingBottom =
              originalPaddingBottom;

            element.style.overflow =
              originalOverflow;
          }
        };


      /*
       * Add one canvas block
       * to current PDF page.
       */
      const addCanvasToPDF =
        (canvas) => {
          const imageData =
            canvas.toDataURL(
              'image/jpeg',
              0.95
            );


          let renderWidth =
            contentWidth;


          let renderHeight =
            (
              canvas.height *
              renderWidth
            ) /
            canvas.width;


          const safePageHeight =
            availableContentHeight -
            paginationSafetyGap;


          /*
           * Last fallback.
           *
           * If a single indivisible block
           * is taller than an entire page,
           * scale it down.
           */
          if (
            renderHeight >
            safePageHeight
          ) {
            const scaleRatio =
              safePageHeight /
              renderHeight;

            renderHeight *=
              scaleRatio;

            renderWidth *=
              scaleRatio;
          }


          const remainingHeight =
            contentBottom -
            currentY -
            paginationSafetyGap;


          if (
            renderHeight >
              remainingHeight &&
            pageHasContent
          ) {
            startNewPage();
          }


          const x =
            sideMargin +
            Math.max(
              0,
              (
                contentWidth -
                renderWidth
              ) / 2
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
            renderHeight +
            blockGap;


          pageHasContent =
            true;
        };


      /*
       * Special photo pagination.
       *
       * Photos are exported
       * 3 per row.
       */
      const addPhotoContainerWithPagination =
        async (
          photoContainer
        ) => {
          const imageElements =
            Array.from(
              photoContainer.children
            ).filter(
              (child) =>
                child.tagName ===
                'IMG'
            );


          if (
            imageElements.length === 0
          ) {
            return;
          }


          const imagesPerRow =
            3;


          for (
            let index = 0;
            index <
            imageElements.length;
            index +=
              imagesPerRow
          ) {
            const temporaryRow =
              document.createElement(
                'div'
              );


            const containerWidth =
              photoContainer
                .getBoundingClientRect()
                .width ||
              photoContainer
                .offsetWidth ||
              730;


            Object.assign(
              temporaryRow.style,
              {
                position:
                  'fixed',

                left:
                  '-10000px',

                top:
                  '0',

                width:
                  `${containerWidth}px`,

                display:
                  'grid',

                gridTemplateColumns:
                  'repeat(3, minmax(0, 1fr))',

                gap:
                  '8px',

                backgroundColor:
                  '#ffffff'
              }
            );


            const rowImages =
              imageElements.slice(
                index,
                index +
                  imagesPerRow
              );


            rowImages.forEach(
              (image) => {
                const clone =
                  image.cloneNode(
                    true
                  );


                Object.assign(
                  clone.style,
                  {
                    width:
                      '100%',

                    height:
                      '180px',

                    maxHeight:
                      '180px',

                    objectFit:
                      'contain',

                    border:
                      '1px solid #e5e7eb',

                    borderRadius:
                      '4px',

                    backgroundColor:
                      '#ffffff',

                    display:
                      'block'
                  }
                );


                temporaryRow
                  .appendChild(
                    clone
                  );
              }
            );


            wrapper.appendChild(
              temporaryRow
            );


            const clonedImages =
              Array.from(
                temporaryRow
                  .querySelectorAll(
                    'img'
                  )
              );


            await Promise.all(
              clonedImages.map(
                (img) =>
                  new Promise(
                    (resolve) => {
                      if (
                        img.complete
                      ) {
                        resolve();
                        return;
                      }

                      img.onload =
                        resolve;

                      img.onerror =
                        resolve;
                    }
                  )
              )
            );


            const rowCanvas =
              await renderElement(
                temporaryRow
              );


            temporaryRow.remove();


            addCanvasToPDF(
              rowCanvas
            );
          }
        };


      /*
       * Recursive pagination.
       */
      const addElementWithPagination =
        async (
          element,
          depth = 0
        ) => {
          if (
            !element ||
            element.offsetHeight <
              2
          ) {
            return;
          }


          const directChildren =
            Array.from(
              element.children
            );


          const computedStyle =
            window.getComputedStyle(
              element
            );


          const directImages =
            directChildren.filter(
              (child) =>
                child.tagName ===
                'IMG'
            );


          /*
           * Detect a pure photo container.
           */
          const isPhotoContainer =
            directChildren.length >
              0 &&
            directImages.length ===
              directChildren.length &&
            (
              computedStyle.display ===
                'flex' ||
              computedStyle.display ===
                'grid'
            );


          if (
            isPhotoContainer
          ) {
            await addPhotoContainerWithPagination(
              element
            );

            return;
          }


          /*
           * Detect whether this section
           * contains a direct photo container.
           */
          const containsPhotoContainer =
            directChildren.some(
              (child) => {
                const childStyle =
                  window.getComputedStyle(
                    child
                  );


                const grandchildren =
                  Array.from(
                    child.children
                  );


                return (
                  grandchildren.length >
                    0 &&
                  grandchildren.every(
                    (
                      grandchild
                    ) =>
                      grandchild.tagName ===
                      'IMG'
                  ) &&
                  (
                    childStyle.display ===
                      'flex' ||
                    childStyle.display ===
                      'grid'
                  )
                );
              }
            );


          const canvas =
            await renderElement(
              element
            );


          const estimatedHeight =
            (
              canvas.height *
              contentWidth
            ) /
            canvas.width;


          const remainingHeight =
            contentBottom -
            currentY -
            paginationSafetyGap;


          /*
           * Fits current remaining page?
           * Add it directly.
           */
          if (
            !containsPhotoContainer &&
            estimatedHeight <=
              remainingHeight
          ) {
            addCanvasToPDF(
              canvas
            );

            return;
          }


          const childElements =
            directChildren.filter(
              (child) =>
                child.offsetHeight >
                1
            );


          const keepTogether =
            element.dataset
              .pdfKeepTogether ===
            'true';


          const cannotSplitFurther =
            keepTogether ||
            childElements.length ===
              0 ||
            depth >= 7 ||
            element.tagName ===
              'TABLE' ||
            element.tagName ===
              'IMG';


          if (
            cannotSplitFurther
          ) {
            addCanvasToPDF(
              canvas
            );

            return;
          }


          for (
            let index = 0;
            index <
            childElements.length;
            index += 1
          ) {
            const child =
              childElements[index];


            const childCanvas =
              await renderElement(
                child
              );


            const childHeight =
              (
                childCanvas.height *
                contentWidth
              ) /
              childCanvas.width;


            const remainingHeight =
              contentBottom -
              currentY -
              paginationSafetyGap;


            const headingType =
              child.dataset.pdfHeading;

            const isSectionHeading =
              headingType === 'section';

            const isSubsectionHeading =
              headingType === 'subsection';

            const hasNextContent =
              index < childElements.length - 1;


            /*
            * Keep heading with the beginning
            * of its next content.
            *
            * The whole content does NOT need
            * to stay together.
            */
            if (
              (isSectionHeading || isSubsectionHeading) &&
              hasNextContent &&
              pageHasContent
            ) {
              const nextChild =
                childElements[index + 1];

              /*
              * Measure the next content.
              */
              const nextCanvas =
                await renderElement(nextChild);

              const nextFullHeight =
                (
                  nextCanvas.height *
                  contentWidth
                ) /
                nextCanvas.width;


              /*
              * We only require a SMALL PART
              * of the next content to stay
              * with the heading.
              *
              * Long content can still split
              * across pages later.
              */
              const minimumContentAfterHeading =
                isSectionHeading
                  ? 18
                  : 12;


              const requiredHeight =
                childHeight +
                Math.min(
                  nextFullHeight,
                  minimumContentAfterHeading
                ) +
                blockGap;


              if (
                requiredHeight >
                remainingHeight
              ) {
                startNewPage();
              }
            }


            await addElementWithPagination(
              child,
              depth + 1
            );
          }
        };


      /*
       * First page header.
       */
      drawHeader();


      /*
       * Add all content
       * in original order.
       */
      for (
        const block of
        contentBlocks
      ) {
        await addElementWithPagination(
          block
        );
      }


      /*
       * Draw correct page numbers.
       */
      drawAllFooters();


      /*
       * TEST filename.
       *
       * This makes it obvious
       * that it came from testing.
       */
      pdf.save(
        `${
          report.report_number ||
          'installation-report'
        }-TEST.pdf`
      );


      toast({
        title:
          'Test PDF exported'
      });
    } catch (error) {
      console.error(
        'Installation Test PDF export failed:',
        error
      );


      toast({
        title:
          'Failed to export Test PDF',

        description:
          error?.message ||
          'Please try again.',

        variant:
          'destructive'
      });
    } finally {
      setExportingPdf(
        false
      );
    }
  };


  /*
   * Auth loading.
   */
  if (isLoadingAuth) {
    return (
      <div className="
        flex
        justify-center
        items-center
        h-64
      ">
        <div className="
          w-6
          h-6
          border-2
          border-primary
          border-t-transparent
          rounded-full
          animate-spin
        " />
      </div>
    );
  }


  /*
   * Only Bianca can access Test PDF page.
   */
  if (!isPDFTester) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  /*
   * Report loading.
   */
  if (isLoading) {
    return (
      <div className="
        flex
        justify-center
        items-center
        h-64
      ">
        <div className="
          w-6
          h-6
          border-2
          border-primary
          border-t-transparent
          rounded-full
          animate-spin
        " />
      </div>
    );
  }


  /*
   * Report not found.
   */
  if (!report) {
    return (
      <div className="
        p-6
        text-center
        text-muted-foreground
      ">
        Report not found.
      </div>
    );
  }


  const sc =
    STATUS_CONFIG[
      report.status
    ] ||
    STATUS_CONFIG.pending;


  const tc =
    TYPE_CONFIG[
      report.report_type
    ] ||
    TYPE_CONFIG.commissioning;


  const equipmentSections =
    report.report_type ===
    'commissioning'
      ? (
          report.equipment_sections ||
          []
        )
      : [];


  const decommissionSections =
    report.report_type ===
    'decommissioning'
      ? (
          report.decommission_sections ||
          report
            .equipment_decommissioned
            ?.map(
              (item) => ({
                section_name: '',
                items: [item]
              })
            ) ||
          []
        )
      : [];


  return (
    <div className="
      p-6
      max-w-4xl
      mx-auto
      space-y-6
    ">

      {/* =====================================
          TEST PAGE HEADER
      ====================================== */}
      <div className="
        flex
        items-start
        justify-between
        flex-wrap
        gap-4
      ">

        <div className="
          flex
          items-center
          gap-3
        ">

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(
                '/installation-pdf-test'
              )
            }
          >
            <ArrowLeft
              size={16}
            />
          </Button>


          <div>

            <div className="
              flex
              items-center
              gap-2
              flex-wrap
            ">

              <h1 className="
                text-xl
                font-semibold
                font-heading
                font-mono
              ">
                {
                  report.report_number
                }
              </h1>


              <Badge
                variant="outline"
                className={
                  `text-[10px] ${tc.className}`
                }
              >
                {tc.label}
              </Badge>


              <Badge
                variant="outline"
                className={
                  `text-[10px] ${sc.className}`
                }
              >
                {sc.label}
              </Badge>

            </div>


            <p className="
              text-xs
              text-muted-foreground
              mt-1
            ">
              PDF Testing · Read Only
            </p>


            {report.created_date && (
              <p className="
                text-xs
                text-muted-foreground
                mt-0.5
              ">
                Created{' '}
                {
                  new Date(
                    report.created_date
                  )
                    .toLocaleDateString()
                }
              </p>
            )}

          </div>

        </div>


        {/* ONLY ACTION: EXPORT */}
        <div className="
          flex
          items-center
          gap-2
        ">

          <Button
            variant="outline"
            size="sm"
            onClick={
              handleExportPdf
            }
            disabled={
              exportingPdf
            }
          >
            <Download
              size={14}
              className="mr-1"
            />

            {
              exportingPdf
                ? 'Exporting…'
                : 'Export Test PDF'
            }

          </Button>

        </div>

      </div>


      {/* =====================================
          CLIENT & SITE
      ====================================== */}
      <div className="
        grid
        grid-cols-1
        md:grid-cols-2
        gap-5
      ">

        <div className="
          bg-card
          border
          border-border
          rounded-xl
          p-5
          space-y-3
        ">

          <h2 className="
            text-xs
            font-mono
            font-semibold
            text-muted-foreground
            uppercase
            tracking-wider
          ">
            Client & Site
          </h2>

          <Field
            label="Client"
            value={
              report.client_name
            }
          />

          <Field
            label="Site / Outlet"
            value={
              report.site_name
            }
          />

          <Field
            label="Location"
            value={
              report.site_location
            }
          />

          <Field
            label="Site PIC"
            value={
              report.site_pic_name
            }
          />

        </div>


        {/* =====================================
            SCHEDULE & ATTENDANCE
        ====================================== */}
        <div className="
          bg-card
          border
          border-border
          rounded-xl
          p-5
          space-y-3
        ">

          <h2 className="
            text-xs
            font-mono
            font-semibold
            text-muted-foreground
            uppercase
            tracking-wider
          ">
            Schedule & Attendance
          </h2>


          <Field
            label="Scheduled Date"
            value={
              report.scheduled_date
            }
          />


          <Field
            label="Scheduled End Date"
            value={
              report.scheduled_end_date
            }
          />


          <Field
            label="Installation Date"
            value={
              report.installation_date
            }
          />


          <Field
            label="Installation Finish Date"
            value={
              report.installation_finish_date
            }
          />


          <Field
            label="Attend Time"
            value={
              report.attend_time
            }
          />


          {report.ack_timestamp && (
            <Field
              label="Completed At"
              value={
                new Date(
                  report.ack_timestamp
                )
                  .toLocaleString(
                    'en-GB',
                    {
                      day:
                        '2-digit',

                      month:
                        'short',

                      year:
                        'numeric',

                      hour:
                        '2-digit',

                      minute:
                        '2-digit',

                      second:
                        '2-digit'
                    }
                  )
              }
            />
          )}


          <Field
            label="Technician"
            value={
              report.attended_staff_name
            }
          />


          <Field
            label="Technician Email"
            value={
              report.attended_staff_email
            }
          />


          <Field
            label="DO Number"
            value={
              report.do_number
            }
          />


          <Field
            label="Work Order No."
            value={
              report.work_order_number
            }
          />


          <Field
            label="Reported By"
            value={
              report.reported_by
            }
          />

        </div>

      </div>


      {/* =====================================
          EQUIPMENT INSTALLED
      ====================================== */}
      {
        equipmentSections.length >
          0 && (

          <div className="
            bg-card
            border
            border-border
            rounded-xl
            p-5
            space-y-4
          ">

            <h2 className="
              text-xs
              font-mono
              font-semibold
              text-muted-foreground
              uppercase
              tracking-wider
              flex
              items-center
              gap-2
            ">

              <Package
                size={14}
              />

              Equipment Installed

            </h2>


            {
              equipmentSections.map(
                (
                  sec,
                  si
                ) => (

                <div
                  key={si}
                  className="
                    border
                    border-primary/20
                    rounded-lg
                    p-4
                    space-y-3
                    bg-muted/10
                  "
                >

                  <p className="
                    text-sm
                    font-semibold
                    text-primary
                  ">
                    {
                      sec.section_name ||
                      `Section ${si + 1}`
                    }
                  </p>


                  <div className="
                    space-y-3
                    pl-2
                    border-l-2
                    border-border
                  ">

                    {
                      (
                        sec.items ||
                        []
                      ).map(
                        (
                          item,
                          ii
                        ) => (

                        <div
                          key={ii}
                          className="
                            border
                            border-border
                            rounded-lg
                            p-3
                            bg-card
                            space-y-2
                          "
                        >

                          <div className="
                            grid
                            grid-cols-2
                            sm:grid-cols-3
                            gap-2
                          ">

                            <Field
                              label="Device Type"
                              value={
                                item.device_type
                              }
                            />

                            <Field
                              label="Device Name"
                              value={
                                item.device_name
                              }
                            />

                            <Field
                              label="Serial Number"
                              value={
                                item.serial_number
                              }
                            />

                            <Field
                              label="Model"
                              value={
                                item.model
                              }
                            />

                            <Field
                              label="SKU"
                              value={
                                item.sku
                              }
                            />

                            <Field
                              label="Anydesk"
                              value={
                                item.anydesk
                              }
                            />

                            <Field
                              label="Length"
                              value={
                                item.length
                              }
                            />

                            <Field
                              label="Quantity"
                              value={
                                item.quantity
                              }
                            />

                            <Field
                              label="Number of Ports"
                              value={
                                item.num_ports
                              }
                            />

                            <Field
                              label="Number of Gang"
                              value={
                                item.num_gang
                              }
                            />

                            <Field
                              label="Notes"
                              value={
                                item.notes
                              }
                            />

                          </div>


                          {
                            item.photos &&
                            item.photos.length >
                              0 && (

                            <div className="
                              flex
                              flex-wrap
                              gap-2
                            ">

                              {
                                item.photos.map(
                                  (
                                    url,
                                    pi
                                  ) => (

                                  <a
                                    key={pi}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <img
                                      src={url}
                                      alt=""
                                      className="
                                        w-20
                                        h-20
                                        object-cover
                                        rounded
                                        border
                                        border-border
                                        hover:opacity-80
                                        transition-opacity
                                      "
                                    />
                                  </a>

                                ))
                              }

                            </div>

                          )}

                        </div>

                      ))
                    }

                  </div>

                </div>

              ))
            }

          </div>

        )
      }


      {/* =====================================
          EQUIPMENT DECOMMISSIONED
      ====================================== */}
      {
        decommissionSections.length >
          0 && (

          <div className="
            bg-card
            border
            border-border
            rounded-xl
            p-5
            space-y-4
          ">

            <h2 className="
              text-xs
              font-mono
              font-semibold
              text-muted-foreground
              uppercase
              tracking-wider
              flex
              items-center
              gap-2
            ">

              <PackageMinus
                size={14}
              />

              Equipment Decommissioned

            </h2>


            {
              decommissionSections.map(
                (
                  sec,
                  si
                ) => (

                <div
                  key={si}
                  className="
                    border
                    border-primary/20
                    rounded-lg
                    p-4
                    space-y-3
                    bg-muted/10
                  "
                >

                  {
                    sec.section_name && (

                    <p className="
                      text-sm
                      font-semibold
                      text-primary
                    ">
                      {
                        sec.section_name
                      }
                    </p>

                  )}


                  <div className="
                    space-y-3
                    pl-2
                    border-l-2
                    border-border
                  ">

                    {
                      (
                        sec.items ||
                        []
                      ).map(
                        (
                          item,
                          ii
                        ) => (

                        <div
                          key={ii}
                          className="
                            border
                            border-border
                            rounded-lg
                            p-3
                            bg-card
                            space-y-2
                          "
                        >

                          <div className="
                            grid
                            grid-cols-2
                            sm:grid-cols-3
                            gap-2
                          ">

                            <Field
                              label="Device Type"
                              value={
                                item.device_type
                              }
                            />

                            <Field
                              label="Device Name"
                              value={
                                item.device_name
                              }
                            />

                            <Field
                              label="Serial Number"
                              value={
                                item.serial_number
                              }
                            />

                            <Field
                              label="Reason"
                              value={
                                item.reason_for_decommission
                              }
                            />

                          </div>


                          {
                            item.photos &&
                            item.photos.length >
                              0 && (

                            <div className="
                              flex
                              flex-wrap
                              gap-2
                            ">

                              {
                                item.photos.map(
                                  (
                                    url,
                                    pi
                                  ) => (

                                  <a
                                    key={pi}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <img
                                      src={url}
                                      alt=""
                                      className="
                                        w-20
                                        h-20
                                        object-cover
                                        rounded
                                        border
                                        border-border
                                        hover:opacity-80
                                        transition-opacity
                                      "
                                    />
                                  </a>

                                ))
                              }

                            </div>

                          )}

                        </div>

                      ))
                    }

                  </div>

                </div>

              ))
            }

          </div>

        )
      }


      {/* =====================================
          PRE-JOB SITE ASSESSMENT
      ====================================== */}
      {(() => {
        const sections =
          report
            .pre_job_assessment_sections ||
          {};


        const hasSections =
          Object
            .values(
              sections
            )
            .some(
              (value) =>
                value &&
                String(
                  value
                ).trim()
            );


        const hasPhotos =
          report
            .pre_job_assessment_photos &&
          report
            .pre_job_assessment_photos
            .length >
            0;


        const hasLegacy =
          report
            .pre_job_assessment;


        if (
          !hasSections &&
          !hasPhotos &&
          !hasLegacy
        ) {
          return null;
        }


        const labels = {
          overall:
            '1. Overall',

          power:
            '2. Power',

          internet:
            '3. Internet',

          cables:
            '4. Cables',

          server_rack:
            '5. Server Rack / Shelves',

          others:
            '6. Others'
        };


        return (
          <div className="
            bg-card
            border
            border-border
            rounded-xl
            p-5
            space-y-3
          ">

            <h2 className="
              text-xs
              font-mono
              font-semibold
              text-muted-foreground
              uppercase
              tracking-wider
            ">
              Pre-Job Site Assessment
            </h2>


            {
              hasLegacy && (

              <p className="
                text-sm
                whitespace-pre-wrap
              ">
                {
                  report
                    .pre_job_assessment
                }
              </p>

            )}


            {
              hasSections && (

              <div className="
                grid
                grid-cols-1
                sm:grid-cols-2
                gap-3
              ">

                {
                  Object
                    .keys(
                      labels
                    )
                    .map(
                      (key) =>
                        sections[
                          key
                        ] ? (

                        <div
                          key={key}
                          className="
                            space-y-1
                          "
                        >

                          <p className="
                            text-[10px]
                            font-mono
                            font-semibold
                            text-muted-foreground
                            uppercase
                            tracking-wider
                          ">
                            {
                              labels[
                                key
                              ]
                            }
                          </p>

                          <p className="
                            text-sm
                            whitespace-pre-wrap
                          ">
                            {
                              sections[
                                key
                              ]
                            }
                          </p>

                        </div>

                      ) : null
                    )
                }

              </div>

            )}


            {
              hasPhotos && (

              <div className="
                flex
                flex-wrap
                gap-2
              ">

                {
                  report
                    .pre_job_assessment_photos
                    .map(
                      (
                        url,
                        index
                      ) => (

                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={url}
                          alt=""
                          className="
                            w-20
                            h-20
                            object-cover
                            rounded
                            border
                            border-border
                            hover:opacity-80
                            transition-opacity
                          "
                        />
                      </a>

                    ))
                }

              </div>

            )}

          </div>
        );
      })()}


      {/* =====================================
          POST JOB TECHNICIAN NOTE
      ====================================== */}
      {
        report
          .technician_notes && (

        <div className="
          bg-card
          border
          border-border
          rounded-xl
          p-5
          space-y-2
        ">

          <h2 className="
            text-xs
            font-mono
            font-semibold
            text-muted-foreground
            uppercase
            tracking-wider
          ">
            Post Job Technician Note
          </h2>


          <p className="
            text-sm
            whitespace-pre-wrap
          ">
            {
              report
                .technician_notes
            }
          </p>

        </div>

      )}


      {/* =====================================
          ACKNOWLEDGEMENT
      ====================================== */}
      {
        (
          report.ack_name ||
          report.ack_phone ||
          report.ack_signature ||
          report.ack_company_stamp
        ) && (

        <div className="
          bg-card
          border
          border-border
          rounded-xl
          p-5
          space-y-3
        ">

          <h2 className="
            text-xs
            font-mono
            font-semibold
            text-muted-foreground
            uppercase
            tracking-wider
          ">
            Acknowledgement
          </h2>


          <div className="
            grid
            grid-cols-2
            gap-4
          ">

            <Field
              label="Name"
              value={
                report.ack_name
              }
            />


            <Field
              label="Phone"
              value={
                report.ack_phone
              }
            />

          </div>


          {
            report
              .ack_timestamp && (

            <Field
              label="Timestamp"
              value={
                new Date(
                  report
                    .ack_timestamp
                )
                  .toLocaleString()
              }
            />

          )}


          <div className="
            grid
            grid-cols-1
            md:grid-cols-2
            gap-4
          ">

            {
              report
                .ack_signature && (

              <div>

                <p className="
                  text-[10px]
                  font-mono
                  font-semibold
                  text-muted-foreground
                  uppercase
                  tracking-wider
                  mb-1
                ">
                  Signature
                </p>


                <img
                  src={
                    report
                      .ack_signature
                  }
                  alt="Signature"
                  className="
                    max-w-xs
                    h-24
                    object-contain
                    border
                    border-border
                    rounded
                    bg-white
                    p-1
                  "
                />

              </div>

            )}


            {
              report
                .ack_company_stamp && (

              <div>

                <p className="
                  text-[10px]
                  font-mono
                  font-semibold
                  text-muted-foreground
                  uppercase
                  tracking-wider
                  mb-1
                ">
                  Company Stamp
                </p>


                <img
                  src={
                    report
                      .ack_company_stamp
                  }
                  alt="Company Stamp"
                  className="
                    max-w-xs
                    h-24
                    object-contain
                    border
                    border-border
                    rounded
                    bg-white
                    p-1
                  "
                />

              </div>

            )}

          </div>

        </div>

      )}


      {/* =====================================
          SUPPORTING PHOTOS
      ====================================== */}
      {
        report
          .supporting_photos &&
        report
          .supporting_photos
          .length >
          0 && (

        <div className="
          bg-card
          border
          border-border
          rounded-xl
          p-5
          space-y-3
        ">

          <h2 className="
            text-xs
            font-mono
            font-semibold
            text-muted-foreground
            uppercase
            tracking-wider
            flex
            items-center
            gap-2
          ">

            <Package
              size={14}
            />

            Supporting Photos

          </h2>


          <div className="
            flex
            flex-wrap
            gap-3
          ">

            {
              report
                .supporting_photos
                .map(
                  (
                    url,
                    index
                  ) => (

                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >

                    <img
                      src={url}
                      alt={
                        `Photo ${index + 1}`
                      }
                      className="
                        w-28
                        h-28
                        object-cover
                        rounded
                        border
                        border-border
                        hover:opacity-80
                        transition-opacity
                      "
                    />

                  </a>

                ))
            }

          </div>

        </div>

      )}


      {/* =====================================
          DELIVERY PHOTOS
      ====================================== */}
      {
        report
          .delivery_photos &&
        report
          .delivery_photos
          .length >
          0 && (

        <div className="
          bg-card
          border
          border-border
          rounded-xl
          p-5
          space-y-3
        ">

          <h2 className="
            text-xs
            font-mono
            font-semibold
            text-muted-foreground
            uppercase
            tracking-wider
            flex
            items-center
            gap-2
          ">

            <Package
              size={14}
            />

            Delivery Photos

          </h2>


          <div className="
            flex
            flex-wrap
            gap-3
          ">

            {
              report
                .delivery_photos
                .map(
                  (
                    url,
                    index
                  ) => (

                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >

                    <img
                      src={url}
                      alt={
                        `Delivery ${index + 1}`
                      }
                      className="
                        w-28
                        h-28
                        object-cover
                        rounded
                        border
                        border-border
                        hover:opacity-80
                        transition-opacity
                      "
                    />

                  </a>

                ))
            }

          </div>

        </div>

      )}


      {/* =====================================
          SUPPORTING DOCUMENTS
      ====================================== */}
      {
        report
          .supporting_documents &&
        report
          .supporting_documents
          .length >
          0 && (

        <div className="
          bg-card
          border
          border-border
          rounded-xl
          p-5
          space-y-2
        ">

          <h2 className="
            text-xs
            font-mono
            font-semibold
            text-muted-foreground
            uppercase
            tracking-wider
            flex
            items-center
            gap-2
          ">

            <FileText
              size={14}
            />

            Supporting Documents

          </h2>


          <div className="
            space-y-1
          ">

            {
              report
                .supporting_documents
                .map(
                  (
                    url,
                    index
                  ) => (

                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="
                      block
                      text-xs
                      text-primary
                      hover:underline
                    "
                  >
                    Document {
                      index + 1
                    }
                  </a>

                ))
            }

          </div>

        </div>

      )}


      {/* =====================================
          HIDDEN PDF TEMPLATE
      ====================================== */}
      <div
        ref={pdfRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '794px',
          background: '#fff',
          color: '#111827',
          fontFamily:
            'Arial, sans-serif',
          fontSize: '12px'
        }}
      >

        {/* HEADER */}
        <div
          style={{
            background:
              '#2563eb',

            padding:
              '20px 32px',

            display:
              'flex',

            justifyContent:
              'space-between',

            alignItems:
              'flex-start'
          }}
        >

          <div>

            <div
              style={{
                fontSize:
                  '20px',

                fontWeight:
                  '700',

                color:
                  '#ffffff',

                letterSpacing:
                  '0.5px'
              }}
            >
              CLICK IX SDN BHD
            </div>


            <div
              style={{
                fontSize:
                  '11px',

                color:
                  '#bfdbfe',

                marginTop:
                  '2px'
              }}
            >
              INSTALLATION REPORT
            </div>


            <div
              style={{
                fontSize:
                  '10px',

                color:
                  '#bfdbfe',

                marginTop:
                  '2px',

                fontFamily:
                  'monospace'
              }}
            >
              {
                report
                  .report_number
              }
            </div>

          </div>


          <div
            style={{
              textAlign:
                'right',

              color:
                '#bfdbfe',

              fontSize:
                '10px'
            }}
          >
            Generated:{' '}
            {
              new Date()
                .toLocaleDateString(
                  'en-GB',
                  {
                    day:
                      '2-digit',

                    month:
                      '2-digit',

                    year:
                      'numeric'
                  }
                )
            }
            ,{' '}
            {
              new Date()
                .toLocaleTimeString()
            }
          </div>

        </div>


        {/* MAIN CONTENT */}
        <div
          style={{
            padding:
              '24px 32px'
          }}
        >

          {/* JOB INFORMATION */}
          <div
            style={{
              marginBottom:
                '20px'
            }}
          >

            <div
              data-pdf-heading="section"
              style={{
                background:
                  '#eff6ff',

                borderLeft:
                  '4px solid #2563eb',

                padding:
                  '6px 12px',

                marginBottom:
                  '12px'
              }}
            >

              <span
                style={{
                  fontSize:
                    '12px',

                  fontWeight:
                    '700',

                  color:
                    '#1d4ed8'
                }}
              >
                Job Information
              </span>

            </div>


            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap:
                  '12px 24px'
              }}
            >

              {
                [
                  [
                    'TECHNICIAN',
                    report
                      .attended_staff_name
                  ],

                  [
                    'TECHNICIAN EMAIL',
                    report
                      .attended_staff_email
                  ],

                  [
                    'STORE',
                    report
                      .site_name
                  ],

                  [
                    'LOCATION',
                    report
                      .site_location
                  ],

                  [
                    'DO NUMBER',
                    report
                      .do_number
                  ],

                  [
                    'WORK ORDER NUMBER',
                    report
                      .work_order_number
                  ],

                  [
                    'SITE PIC',
                    report
                      .site_pic_name
                  ],

                  [
                    'REPORTED BY',
                    report
                      .reported_by
                  ],

                  [
                    'CLIENT',
                    report
                      .client_name
                  ],

                  [
                    'REPORT TYPE',
                    tc.label
                  ]
                ]
                  .filter(
                    (
                      [
                        ,
                        value
                      ]
                    ) =>
                      value !==
                        null &&
                      value !==
                        undefined &&
                      value !==
                        ''
                  )
                  .map(
                    (
                      [
                        key,
                        value
                      ]
                    ) => (

                    <div
                      key={key}
                    >

                      <div
                        style={{
                          fontSize:
                            '9px',

                          fontWeight:
                            '700',

                          color:
                            '#6b7280',

                          textTransform:
                            'uppercase',

                          letterSpacing:
                            '0.5px',

                          marginBottom:
                            '2px'
                        }}
                      >
                        {key}
                      </div>


                      <div
                        style={{
                          fontSize:
                            '12px',

                          color:
                            '#111827',

                          whiteSpace:
                            'pre-wrap',

                          overflowWrap:
                            'anywhere'
                        }}
                      >
                        {
                          String(
                            value
                          )
                        }
                      </div>

                    </div>

                  ))
              }

            </div>

          </div>


          {/* SCHEDULE & ATTENDANCE */}
          <div
            style={{
              marginBottom:
                '20px'
            }}
          >

            <div
              data-pdf-heading="section"
              style={{
                background:
                  '#eff6ff',

                borderLeft:
                  '4px solid #2563eb',

                padding:
                  '6px 12px',

                marginBottom:
                  '12px'
              }}
            >

              <span
                style={{
                  fontSize:
                    '12px',

                  fontWeight:
                    '700',

                  color:
                    '#1d4ed8'
                }}
              >
                Schedule & Attendance
              </span>

            </div>


            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap:
                  '12px 24px'
              }}
            >

              {
                [
                  [
                    'SCHEDULED DATE',
                    report
                      .scheduled_date
                  ],

                  [
                    'SCHEDULED END DATE',
                    report
                      .scheduled_end_date
                  ],

                  [
                    'INSTALLATION DATE',
                    report
                      .installation_date
                  ],

                  [
                    'INSTALLATION FINISH DATE',
                    report
                      .installation_finish_date
                  ],

                  [
                    'ATTEND TIME',
                    report
                      .attend_time
                  ],

                  [
                    'STATUS',
                    sc.label
                  ]
                ]
                  .filter(
                    (
                      [
                        ,
                        value
                      ]
                    ) =>
                      value !==
                        null &&
                      value !==
                        undefined &&
                      value !==
                        ''
                  )
                  .map(
                    (
                      [
                        key,
                        value
                      ]
                    ) => (

                    <div
                      key={key}
                    >

                      <div
                        style={{
                          fontSize:
                            '9px',

                          fontWeight:
                            '700',

                          color:
                            '#6b7280',

                          textTransform:
                            'uppercase',

                          letterSpacing:
                            '0.5px',

                          marginBottom:
                            '2px'
                        }}
                      >
                        {key}
                      </div>


                      <div
                        style={{
                          fontSize:
                            '12px',

                          color:
                            '#111827',

                          whiteSpace:
                            'pre-wrap'
                        }}
                      >
                        {
                          String(
                            value
                          )
                        }
                      </div>

                    </div>

                  ))
              }

            </div>

          </div>


          {/* =====================================
              EQUIPMENT INSTALLED PDF
          ====================================== */}
          {
            equipmentSections.length >
              0 && (

            <div
              style={{
                marginBottom:
                  '20px'
              }}
            >

              <div
                data-pdf-heading="section"
                style={{
                  background:
                    '#eff6ff',

                  borderLeft:
                    '4px solid #2563eb',

                  padding:
                    '6px 12px',

                  marginBottom:
                    '12px'
                }}
              >

                <span
                  style={{
                    fontSize:
                      '12px',

                    fontWeight:
                      '700',

                    color:
                      '#1d4ed8'
                  }}
                >
                  Equipment Installed
                </span>

              </div>


              {
                equipmentSections.map(
                  (
                    sec,
                    si
                  ) => (

                  <div
                    key={si}
                    style={{
                      marginBottom:
                        '16px'
                    }}
                  >

                    <div
                      data-pdf-heading="subsection"
                      style={{
                        background:
                          '#f0f9ff',

                        borderLeft:
                          '3px solid #60a5fa',

                        padding:
                          '5px 10px',

                        marginBottom:
                          '8px',

                        fontWeight:
                          '700',

                        fontSize:
                          '11px',

                        color:
                          '#1d4ed8'
                      }}
                    >
                      {
                        sec.section_name ||
                        `Section ${
                          si + 1
                        }`
                      }
                    </div>


                    <table
                      style={{
                        width:
                          '100%',

                        borderCollapse:
                          'collapse',

                        fontSize:
                          '11px'
                      }}
                    >

                      <thead>

                        <tr
                          style={{
                            background:
                              '#f3f4f6'
                          }}
                        >

                          {
                            [
                              '#',
                              'Device Type',
                              'Device Name',
                              'Serial Number',
                              'Specifications',
                              'Notes'
                            ].map(
                              (
                                heading
                              ) => (

                              <th
                                key={
                                  heading
                                }
                                style={{
                                  padding:
                                    '7px',

                                  textAlign:
                                    'left',

                                  border:
                                    '1px solid #e5e7eb'
                                }}
                              >
                                {heading}
                              </th>

                            ))
                          }

                        </tr>

                      </thead>


                      <tbody>

                        {
                          (
                            sec.items ||
                            []
                          ).map(
                            (
                              item,
                              ii
                            ) => {

                            const specs =
                              [
                                item.model &&
                                  `Model: ${item.model}`,

                                item.sku &&
                                  `SKU: ${item.sku}`,

                                item.anydesk &&
                                  `Anydesk: ${item.anydesk}`,

                                item.length &&
                                  `Length: ${item.length}`,

                                (
                                  item.quantity !==
                                    null &&
                                  item.quantity !==
                                    undefined &&
                                  item.quantity !==
                                    ''
                                ) &&
                                  `Qty: ${item.quantity}`,

                                (
                                  item.num_ports !==
                                    null &&
                                  item.num_ports !==
                                    undefined &&
                                  item.num_ports !==
                                    ''
                                ) &&
                                  `Ports: ${item.num_ports}`,

                                (
                                  item.num_gang !==
                                    null &&
                                  item.num_gang !==
                                    undefined &&
                                  item.num_gang !==
                                    ''
                                ) &&
                                  `Gang: ${item.num_gang}`
                              ]
                                .filter(
                                  Boolean
                                )
                                .join(
                                  '\n'
                                );


                            return (
                              <tr
                                key={
                                  ii
                                }
                                style={{
                                  background:
                                    ii %
                                      2 ===
                                    0
                                      ? '#fff'
                                      : '#f9fafb'
                                }}
                              >

                                <td
                                  style={{
                                    padding:
                                      '7px',

                                    border:
                                      '1px solid #e5e7eb'
                                  }}
                                >
                                  {
                                    ii +
                                    1
                                  }
                                </td>


                                <td
                                  style={{
                                    padding:
                                      '7px',

                                    border:
                                      '1px solid #e5e7eb'
                                  }}
                                >
                                  {
                                    item.device_type ||
                                    ''
                                  }
                                </td>


                                <td
                                  style={{
                                    padding:
                                      '7px',

                                    border:
                                      '1px solid #e5e7eb'
                                  }}
                                >
                                  {
                                    item.device_name ||
                                    ''
                                  }
                                </td>


                                <td
                                  style={{
                                    padding:
                                      '7px',

                                    border:
                                      '1px solid #e5e7eb',

                                    fontFamily:
                                      'monospace'
                                  }}
                                >
                                  {
                                    item.serial_number ||
                                    ''
                                  }
                                </td>


                                <td
                                  style={{
                                    padding:
                                      '7px',

                                    border:
                                      '1px solid #e5e7eb',

                                    whiteSpace:
                                      'pre-line',

                                    fontSize:
                                      '10px',

                                    color:
                                      '#374151'
                                  }}
                                >
                                  {
                                    specs ||
                                    '—'
                                  }
                                </td>


                                <td
                                  style={{
                                    padding:
                                      '7px',

                                    border:
                                      '1px solid #e5e7eb',

                                    whiteSpace:
                                      'pre-wrap',

                                    overflowWrap:
                                      'anywhere'
                                  }}
                                >
                                  {
                                    item.notes ||
                                    ''
                                  }
                                </td>

                              </tr>
                            );
                          })
                        }

                      </tbody>

                    </table>


                    {
                      (
                        sec.items ||
                        []
                      ).some(
                        (
                          item
                        ) =>
                          item.photos &&
                          item.photos.length >
                            0
                      ) && (

                      <div
                        style={{
                          marginTop:
                            '10px'
                        }}
                      >

                        {
                          (
                            sec.items ||
                            []
                          ).map(
                            (
                              item,
                              ii
                            ) =>
                              item.photos &&
                              item.photos.length >
                                0 ? (

                              <div
                                key={
                                  ii
                                }
                                style={{
                                  marginBottom:
                                    '8px'
                                }}
                              >

                                <div
                                  data-pdf-heading="subsection"
                                  style={{
                                    fontSize:
                                      '10px',

                                    color:
                                      '#6b7280',

                                    marginBottom:
                                      '5px',

                                    fontWeight:
                                      '600'
                                  }}
                                >
                                  {
                                    item.device_name ||
                                    `Device ${
                                      ii +
                                      1
                                    }`
                                  }{' '}
                                  Photos:
                                </div>


                                <div
                                  style={{
                                    display:
                                      'flex',

                                    flexWrap:
                                      'wrap',

                                    gap:
                                      '8px'
                                  }}
                                >

                                  {
                                    item.photos.map(
                                      (
                                        url,
                                        pi
                                      ) => (

                                      <img
                                        key={
                                          pi
                                        }
                                        src={
                                          url
                                        }
                                        alt=""
                                        crossOrigin="anonymous"
                                        style={{
                                          width:
                                            '220px',

                                          height:
                                            'auto',

                                          maxHeight:
                                            '260px',

                                          objectFit:
                                            'contain',

                                          border:
                                            '1px solid #e5e7eb',

                                          borderRadius:
                                            '4px',

                                          background:
                                            '#ffffff',

                                          display:
                                            'block'
                                        }}
                                      />

                                    ))
                                  }

                                </div>

                              </div>

                            ) : null
                          )
                        }

                      </div>

                    )}

                  </div>

                ))
              }

            </div>

          )}


          {/* =====================================
              EQUIPMENT DECOMMISSIONED PDF
          ====================================== */}
          {
            decommissionSections.length >
              0 && (

            <div
              style={{
                marginBottom:
                  '20px'
              }}
            >

              <div
                data-pdf-heading="section"
                style={{
                  background:
                    '#eff6ff',

                  borderLeft:
                    '4px solid #2563eb',

                  padding:
                    '6px 12px',

                  marginBottom:
                    '12px'
                }}
              >

                <span
                  style={{
                    fontSize:
                      '12px',

                    fontWeight:
                      '700',

                    color:
                      '#1d4ed8'
                  }}
                >
                  Equipment Decommissioned
                </span>

              </div>


              {
                decommissionSections.map(
                  (
                    sec,
                    si
                  ) => (

                  <div
                    key={si}
                    style={{
                      marginBottom:
                        '16px'
                    }}
                  >

                    {
                      sec.section_name && (

                      <div
                        data-pdf-heading="subsection"
                        style={{
                          background:
                            '#f0f9ff',

                          borderLeft:
                            '3px solid #60a5fa',

                          padding:
                            '5px 10px',

                          marginBottom:
                            '8px',

                          fontWeight:
                            '700',

                          fontSize:
                            '11px',

                          color:
                            '#1d4ed8'
                        }}
                      >
                        {
                          sec.section_name
                        }
                      </div>

                    )}


                    <table
                      style={{
                        width:
                          '100%',

                        borderCollapse:
                          'collapse',

                        fontSize:
                          '11px'
                      }}
                    >

                      <thead>

                        <tr
                          style={{
                            background:
                              '#f3f4f6'
                          }}
                        >

                          {
                            [
                              '#',
                              'Device Type',
                              'Device Name / Model',
                              'Serial Number',
                              'Reason'
                            ].map(
                              (
                                heading
                              ) => (

                              <th
                                key={
                                  heading
                                }
                                style={{
                                  padding:
                                    '7px',

                                  textAlign:
                                    'left',

                                  border:
                                    '1px solid #e5e7eb'
                                }}
                              >
                                {heading}
                              </th>

                            ))
                          }

                        </tr>

                      </thead>


                      <tbody>

                        {
                          (
                            sec.items ||
                            []
                          ).map(
                            (
                              item,
                              ii
                            ) => (

                            <tr
                              key={
                                ii
                              }
                              style={{
                                background:
                                  ii %
                                    2 ===
                                  0
                                    ? '#fff'
                                    : '#f9fafb'
                              }}
                            >

                              <td
                                style={{
                                  padding:
                                    '7px',

                                  border:
                                    '1px solid #e5e7eb'
                                }}
                              >
                                {
                                  ii +
                                  1
                                }
                              </td>


                              <td
                                style={{
                                  padding:
                                    '7px',

                                  border:
                                    '1px solid #e5e7eb'
                                }}
                              >
                                {
                                  item.device_type ||
                                  ''
                                }
                              </td>


                              <td
                                style={{
                                  padding:
                                    '7px',

                                  border:
                                    '1px solid #e5e7eb'
                                }}
                              >
                                {
                                  item.device_name ||
                                  ''
                                }
                              </td>


                              <td
                                style={{
                                  padding:
                                    '7px',

                                  border:
                                    '1px solid #e5e7eb',

                                  fontFamily:
                                    'monospace'
                                }}
                              >
                                {
                                  item.serial_number ||
                                  ''
                                }
                              </td>


                              <td
                                style={{
                                  padding:
                                    '7px',

                                  border:
                                    '1px solid #e5e7eb',

                                  whiteSpace:
                                    'pre-wrap'
                                }}
                              >
                                {
                                  item.reason_for_decommission ||
                                  ''
                                }
                              </td>

                            </tr>

                          ))
                        }

                      </tbody>

                    </table>


                    {
                      (
                        sec.items ||
                        []
                      ).some(
                        (
                          item
                        ) =>
                          item.photos &&
                          item.photos.length >
                            0
                      ) && (

                      <div
                        style={{
                          marginTop:
                            '10px'
                        }}
                      >

                        {
                          (
                            sec.items ||
                            []
                          ).map(
                            (
                              item,
                              ii
                            ) =>
                              item.photos &&
                              item.photos.length >
                                0 ? (

                              <div
                                key={
                                  ii
                                }
                                style={{
                                  marginBottom:
                                    '8px'
                                }}
                              >

                                <div
                                  data-pdf-heading="subsection"
                                  style={{
                                    fontSize:
                                      '10px',

                                    color:
                                      '#6b7280',

                                    marginBottom:
                                      '5px',

                                    fontWeight:
                                      '600'
                                  }}
                                >
                                  {
                                    item.device_name ||
                                    `Device ${
                                      ii +
                                      1
                                    }`
                                  }{' '}
                                  Photos:
                                </div>


                                <div
                                  style={{
                                    display:
                                      'flex',

                                    flexWrap:
                                      'wrap',

                                    gap:
                                      '8px'
                                  }}
                                >

                                  {
                                    item.photos.map(
                                      (
                                        url,
                                        pi
                                      ) => (

                                      <img
                                        key={
                                          pi
                                        }
                                        src={
                                          url
                                        }
                                        alt=""
                                        crossOrigin="anonymous"
                                        style={{
                                          width:
                                            '220px',

                                          height:
                                            'auto',

                                          maxHeight:
                                            '260px',

                                          objectFit:
                                            'contain',

                                          border:
                                            '1px solid #e5e7eb',

                                          borderRadius:
                                            '4px',

                                          background:
                                            '#ffffff',

                                          display:
                                            'block'
                                        }}
                                      />

                                    ))
                                  }

                                </div>

                              </div>

                            ) : null
                          )
                        }

                      </div>

                    )}

                  </div>

                ))
              }

            </div>

          )}


          {/* =====================================
              PRE-JOB SITE ASSESSMENT PDF
          ====================================== */}
          {(() => {
            const sections =
              report
                .pre_job_assessment_sections ||
              {};


            const hasSections =
              Object
                .values(
                  sections
                )
                .some(
                  (
                    value
                  ) =>
                    value &&
                    String(
                      value
                    ).trim()
                );


            const hasPhotos =
              report
                .pre_job_assessment_photos &&
              report
                .pre_job_assessment_photos
                .length >
                0;


            const hasLegacy =
              report
                .pre_job_assessment;


            if (
              !hasSections &&
              !hasPhotos &&
              !hasLegacy
            ) {
              return null;
            }


            const labels = {
              overall:
                '1. Overall',

              power:
                '2. Power',

              internet:
                '3. Internet',

              cables:
                '4. Cables',

              server_rack:
                '5. Server Rack / Shelves',

              others:
                '6. Others'
            };


            return (
              <div
                style={{
                  marginBottom:
                    '20px'
                }}
              >

                <div
                  data-pdf-heading="section"
                  style={{
                    background:
                      '#eff6ff',

                    borderLeft:
                      '4px solid #2563eb',

                    padding:
                      '6px 12px',

                    marginBottom:
                      '10px'
                  }}
                >

                  <span
                    style={{
                      fontSize:
                        '12px',

                      fontWeight:
                        '700',

                      color:
                        '#1d4ed8'
                    }}
                  >
                    Pre-Job Site Assessment
                  </span>

                </div>


                {
                  hasLegacy && (

                  <div
                    style={{
                      border:
                        '1px solid #e5e7eb',

                      borderRadius:
                        '4px',

                      padding:
                        '12px',

                      background:
                        '#f9fafb',

                      whiteSpace:
                        'pre-wrap',

                      lineHeight:
                        '1.6',

                      fontSize:
                        '12px',

                      marginBottom:
                        '10px',

                      overflowWrap:
                        'anywhere'
                    }}
                  >
                    {
                      report
                        .pre_job_assessment
                    }
                  </div>

                )}


                {
                  hasSections && (

                  <div
                    style={{
                      display:
                        'grid',

                      gridTemplateColumns:
                        '1fr 1fr',

                      gap:
                        '10px 20px',

                      marginBottom:
                        hasPhotos
                          ? '10px'
                          : '0'
                    }}
                  >

                    {
                      Object
                        .keys(
                          labels
                        )
                        .map(
                          (
                            key
                          ) =>
                            sections[
                              key
                            ] ? (

                            <div
                              key={
                                key
                              }
                              style={{
                                border:
                                  '1px solid #e5e7eb',

                                borderRadius:
                                  '4px',

                                padding:
                                  '8px 10px',

                                background:
                                  '#f9fafb'
                              }}
                            >

                              <div
                                style={{
                                  fontSize:
                                    '9px',

                                  fontWeight:
                                    '700',

                                  color:
                                    '#6b7280',

                                  textTransform:
                                    'uppercase',

                                  letterSpacing:
                                    '0.5px',

                                  marginBottom:
                                    '3px'
                                }}
                              >
                                {
                                  labels[
                                    key
                                  ]
                                }
                              </div>


                              <div
                                style={{
                                  fontSize:
                                    '11px',

                                  color:
                                    '#111827',

                                  whiteSpace:
                                    'pre-wrap',

                                  lineHeight:
                                    '1.5',

                                  overflowWrap:
                                    'anywhere'
                                }}
                              >
                                {
                                  sections[
                                    key
                                  ]
                                }
                              </div>

                            </div>

                          ) : null
                        )
                    }

                  </div>

                )}


                {
                  hasPhotos && (

                  <div
                    style={{
                      display:
                        'flex',

                      flexWrap:
                        'wrap',

                      gap:
                        '8px'
                    }}
                  >

                    {
                      report
                        .pre_job_assessment_photos
                        .map(
                          (
                            url,
                            index
                          ) => (

                          <img
                            key={
                              index
                            }
                            src={
                              url
                            }
                            alt=""
                            crossOrigin="anonymous"
                            style={{
                              width:
                                '145px',

                              height:
                                'auto',

                              maxHeight:
                                '180px',

                              objectFit:
                                'contain',

                              border:
                                '1px solid #e5e7eb',

                              borderRadius:
                                '4px',

                              background:
                                '#ffffff',

                              display:
                                'block'
                            }}
                          />

                        ))
                    }

                  </div>

                )}

              </div>
            );
          })()}


          {/* =====================================
              POST JOB TECHNICIAN NOTE PDF
          ====================================== */}
          {
            report
              .technician_notes && (

            <div
              style={{
                marginBottom:
                  '20px'
              }}
            >

              <div
                data-pdf-heading="section"
                style={{
                  background:
                    '#eff6ff',

                  borderLeft:
                    '4px solid #2563eb',

                  padding:
                    '6px 12px',

                  marginBottom:
                    '10px'
                }}
              >

                <span
                  style={{
                    fontSize:
                      '12px',

                    fontWeight:
                      '700',

                    color:
                      '#1d4ed8'
                  }}
                >
                  Post Job Technician Note
                </span>

              </div>


              <div
                style={{
                  border:
                    '1px solid #e5e7eb',

                  borderRadius:
                    '4px',

                  padding:
                    '12px',

                  background:
                    '#f9fafb',

                  whiteSpace:
                    'pre-wrap',

                  lineHeight:
                    '1.6',

                  fontSize:
                    '12px',

                  overflowWrap:
                    'anywhere'
                }}
              >
                {
                  report
                    .technician_notes
                }
              </div>

            </div>

          )}


          {/* =====================================
              SUPPORTING PHOTOS PDF
          ====================================== */}
          {
            report
              .supporting_photos &&
            report
              .supporting_photos
              .length >
              0 && (

            <div
              style={{
                marginBottom:
                  '20px'
              }}
            >

              <div
                data-pdf-heading="section"
                style={{
                  background:
                    '#eff6ff',

                  borderLeft:
                    '4px solid #2563eb',

                  padding:
                    '6px 12px',

                  marginBottom:
                    '10px'
                }}
              >

                <span
                  style={{
                    fontSize:
                      '12px',

                    fontWeight:
                      '700',

                    color:
                      '#1d4ed8'
                  }}
                >
                  Photo Evidence
                </span>

              </div>


              <div
                style={{
                  display:
                    'flex',

                  flexWrap:
                    'wrap',

                  gap:
                    '8px'
                }}
              >

                {
                  report
                    .supporting_photos
                    .map(
                      (
                        url,
                        index
                      ) => (

                      <img
                        key={
                          index
                        }
                        src={
                          url
                        }
                        alt=""
                        crossOrigin="anonymous"
                        style={{
                          width:
                            '145px',

                          height:
                            'auto',

                          maxHeight:
                            '180px',

                          objectFit:
                            'contain',

                          border:
                            '1px solid #e5e7eb',

                          borderRadius:
                            '4px',

                          background:
                            '#ffffff',

                          display:
                            'block'
                        }}
                      />

                    ))
                }

              </div>

            </div>

          )}


          {/* =====================================
              DELIVERY PHOTOS PDF
          ====================================== */}
          {
            report
              .delivery_photos &&
            report
              .delivery_photos
              .length >
              0 && (

            <div
              style={{
                marginBottom:
                  '20px'
              }}
            >

              <div
                data-pdf-heading="section"
                style={{
                  background:
                    '#eff6ff',

                  borderLeft:
                    '4px solid #2563eb',

                  padding:
                    '6px 12px',

                  marginBottom:
                    '10px'
                }}
              >

                <span
                  style={{
                    fontSize:
                      '12px',

                    fontWeight:
                      '700',

                    color:
                      '#1d4ed8'
                  }}
                >
                  Delivery Photos
                </span>

              </div>


              <div
                style={{
                  display:
                    'flex',

                  flexWrap:
                    'wrap',

                  gap:
                    '8px'
                }}
              >

                {
                  report
                    .delivery_photos
                    .map(
                      (
                        url,
                        index
                      ) => (

                      <img
                        key={
                          index
                        }
                        src={
                          url
                        }
                        alt=""
                        crossOrigin="anonymous"
                        style={{
                          width:
                            '145px',

                          height:
                            'auto',

                          maxHeight:
                            '180px',

                          objectFit:
                            'contain',

                          border:
                            '1px solid #e5e7eb',

                          borderRadius:
                            '4px',

                          background:
                            '#ffffff',

                          display:
                            'block'
                        }}
                      />

                    ))
                }

              </div>

            </div>

          )}


          {/* =====================================
              SUPPORTING DOCUMENTS PDF
          ====================================== */}
          {
            report
              .supporting_documents &&
            report
              .supporting_documents
              .length >
              0 && (

            <div
              style={{
                marginBottom:
                  '20px'
              }}
            >

              <div
                data-pdf-heading="section"
                style={{
                  background:
                    '#eff6ff',

                  borderLeft:
                    '4px solid #2563eb',

                  padding:
                    '6px 12px',

                  marginBottom:
                    '10px'
                }}
              >

                <span
                  style={{
                    fontSize:
                      '12px',

                    fontWeight:
                      '700',

                    color:
                      '#1d4ed8'
                  }}
                >
                  Supporting Documents
                </span>

              </div>


              <div
                style={{
                  display:
                    'flex',

                  flexDirection:
                    'column',

                  gap:
                    '4px'
                }}
              >

                {
                  report
                    .supporting_documents
                    .map(
                      (
                        url,
                        index
                      ) => (

                      <a
                        key={
                          index
                        }
                        href={
                          url
                        }
                        style={{
                          fontSize:
                            '11px',

                          color:
                            '#1d4ed8',

                          textDecoration:
                            'underline',

                          wordBreak:
                            'break-all'
                        }}
                      >
                        Document {
                          index + 1
                        }
                      </a>

                    ))
                }

              </div>

            </div>

          )}


          {/* =====================================
              CLIENT SIGNATURE PDF
          ====================================== */}
          {
            (
              report.ack_name ||
              report.ack_phone ||
              report.ack_signature ||
              report.ack_company_stamp
            ) && (

            <div
              data-pdf-keep-together="true"
              style={{
                marginTop:
                  '24px'
              }}
            >

              <div
                data-pdf-heading="section"
                style={{
                  background:
                    '#eff6ff',

                  borderLeft:
                    '4px solid #2563eb',

                  padding:
                    '6px 12px',

                  marginBottom:
                    '16px'
                }}
              >

                <span
                  style={{
                    fontSize:
                      '12px',

                    fontWeight:
                      '700',

                    color:
                      '#1d4ed8'
                  }}
                >
                  Client Signature
                </span>

              </div>


              {
                report
                  .ack_signature
                  ? (

                  <img
                    src={
                      report
                        .ack_signature
                    }
                    alt="sig"
                    crossOrigin="anonymous"
                    style={{
                      maxHeight:
                        '100px',

                      maxWidth:
                        '220px',

                      display:
                        'block',

                      marginBottom:
                        '12px'
                    }}
                  />

                ) : (

                  <div
                    style={{
                      border:
                        '1px solid #e5e7eb',

                      height:
                        '70px',

                      width:
                        '220px',

                      borderRadius:
                        '4px',

                      display:
                        'flex',

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      color:
                        '#9ca3af',

                      fontSize:
                        '10px',

                      marginBottom:
                        '12px'
                    }}
                  >
                    No signature captured
                  </div>

                )
              }


              <div
                style={{
                  fontSize:
                    '13px',

                  marginBottom:
                    '4px'
                }}
              >
                <strong>
                  Name:
                </strong>{' '}
                {
                  report
                    .ack_name ||
                  ''
                }
              </div>


              <div
                style={{
                  fontSize:
                    '13px',

                  marginBottom:
                    '4px'
                }}
              >
                <strong>
                  Phone:
                </strong>{' '}
                {
                  report
                    .ack_phone ||
                  ''
                }
              </div>


              {
                report
                  .ack_timestamp && (

                <div
                  style={{
                    fontSize:
                      '12px',

                    color:
                      '#6b7280'
                  }}
                >
                  Signed on:{' '}
                  {
                    new Date(
                      report
                        .ack_timestamp
                    )
                      .toLocaleString()
                  }
                </div>

              )}


              {
                report
                  .ack_company_stamp && (

                <div
                  style={{
                    marginTop:
                      '16px'
                  }}
                >

                  <div
                    style={{
                      fontSize:
                        '9px',

                      fontWeight:
                        '700',

                      color:
                        '#6b7280',

                      textTransform:
                        'uppercase',

                      letterSpacing:
                        '0.5px',

                      marginBottom:
                        '8px'
                    }}
                  >
                    COMPANY STAMP
                  </div>


                  <img
                    src={
                      report
                        .ack_company_stamp
                    }
                    alt="stamp"
                    crossOrigin="anonymous"
                    style={{
                      maxWidth:
                        '200px',

                      maxHeight:
                        '120px',

                      objectFit:
                        'contain'
                    }}
                  />

                </div>

              )}

            </div>

          )}

        </div>


        {/* OLD HIDDEN FOOTER
            Actual page numbers are drawn
            by jsPDF after pagination.
        */}
        <div
          style={{
            borderTop:
              '1px solid #e5e7eb',

            padding:
              '8px 32px',

            display:
              'flex',

            justifyContent:
              'space-between',

            fontSize:
              '9px',

            color:
              '#9ca3af'
          }}
        >

          <span>
            Installation Report
          </span>

          <span>
            {
              report
                .report_number
            }
          </span>

        </div>

      </div>

    </div>
  );
}