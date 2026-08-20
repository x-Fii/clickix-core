import { useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import {
  Search,
  FileText
} from 'lucide-react';


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


export default function InstallationPDFTest() {
  const { user, isLoadingAuth } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');


  /*
   * Only Bianca can see/use this testing page.
   */
  const isPDFTester =
    user?.email?.toLowerCase() === 'bianca@click-ix.com';


  /*
   * IMPORTANT:
   *
   * Read the SAME InstallationReport database
   * as the real Installation Reports page.
   *
   * READ ONLY.
   */
  const {
    data: reports = [],
    isLoading
  } = useQuery({
    queryKey: ['installation-reports-pdf-test'],

    queryFn: () =>
      base44.entities.InstallationReport.list(
        '-created_date',
        200
      ),

    enabled:
      !isLoadingAuth &&
      isPDFTester
  });


  /*
   * Get client names for filter.
   */
  const clients = useMemo(() => {
    const names = reports
      .map((report) => report.client_name)
      .filter(Boolean);

    return [
      ...new Set(names)
    ].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [reports]);


  /*
   * Filter reports.
   */
  const filteredReports = useMemo(() => {
    const keyword =
      search.trim().toLowerCase();

    return reports.filter((report) => {
      /*
       * Search:
       * Report No
       * Client
       * Site
       * Technician
       * DO
       * Work Order
       */
      const matchesSearch =
        !keyword ||
        [
          report.report_number,
          report.client_name,
          report.site_name,
          report.site_location,
          report.attended_staff_name,
          report.attended_staff_email,
          report.do_number,
          report.work_order_number
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(keyword)
          );


      const matchesStatus =
        statusFilter === 'all' ||
        report.status === statusFilter;


      const matchesType =
        typeFilter === 'all' ||
        report.report_type === typeFilter;


      const matchesClient =
        clientFilter === 'all' ||
        report.client_name === clientFilter;


      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesClient
      );
    });
  }, [
    reports,
    search,
    statusFilter,
    typeFilter,
    clientFilter
  ]);


  /*
   * Wait for auth.
   */
  if (isLoadingAuth) {
    return (
      <div className="flex justify-center items-center h-64">
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
   * Protect testing page.
   */
  if (!isPDFTester) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  return (
    <div className="p-6 space-y-6">

      {/* =====================================
          PAGE HEADER
      ====================================== */}
      <div className="
        flex
        items-start
        justify-between
        gap-4
        flex-wrap
      ">

        <div>
          <div className="
            flex
            items-center
            gap-2
          ">
            <FileText
              size={20}
              className="text-primary"
            />

            <h1 className="
              text-xl
              font-semibold
              font-heading
            ">
              Installation PDF Testing
            </h1>
          </div>


          <p className="
            text-sm
            text-muted-foreground
            mt-1
          ">
            Read-only testing page for Installation Report PDF export.
          </p>
        </div>


        <Badge
          variant="outline"
          className="
            bg-amber-500/10
            text-amber-500
            border-amber-500/30
          "
        >
          PDF TESTING
        </Badge>

      </div>


      {/* =====================================
          FILTERS
      ====================================== */}
      <div className="
        bg-card
        border
        border-border
        rounded-xl
        p-4
      ">

        <div className="
          flex
          flex-col
          xl:flex-row
          gap-3
        ">

          {/* SEARCH */}
          <div className="
            relative
            flex-1
            min-w-[220px]
          ">

            <Search
              size={15}
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                text-muted-foreground
              "
            />

            <Input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search reports..."
              className="pl-9"
            />

          </div>


          {/* STATUS */}
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >

            <SelectTrigger className="w-full xl:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All Statuses
              </SelectItem>

              <SelectItem value="pending">
                Pending
              </SelectItem>

              <SelectItem value="scheduled">
                Scheduled
              </SelectItem>

              <SelectItem value="completed">
                Completed
              </SelectItem>

              <SelectItem value="billed">
                Billed
              </SelectItem>

              <SelectItem value="cancelled">
                Cancelled
              </SelectItem>
            </SelectContent>

          </Select>


          {/* TYPE */}
          <Select
            value={typeFilter}
            onValueChange={setTypeFilter}
          >

            <SelectTrigger className="w-full xl:w-[170px]">
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All Types
              </SelectItem>

              <SelectItem value="commissioning">
                Commission
              </SelectItem>

              <SelectItem value="decommissioning">
                Decommission
              </SelectItem>
            </SelectContent>

          </Select>


          {/* CLIENT */}
          <Select
            value={clientFilter}
            onValueChange={setClientFilter}
          >

            <SelectTrigger className="w-full xl:w-[200px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All Clients
              </SelectItem>

              {clients.map((client) => (
                <SelectItem
                  key={client}
                  value={client}
                >
                  {client}
                </SelectItem>
              ))}
            </SelectContent>

          </Select>

        </div>

      </div>


      {/* =====================================
          REPORT TABLE
      ====================================== */}
      <div className="
        bg-card
        border
        border-border
        rounded-xl
        overflow-hidden
      ">

        {isLoading ? (

          <div className="
            flex
            justify-center
            items-center
            h-48
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

        ) : filteredReports.length === 0 ? (

          <div className="
            py-16
            text-center
            text-muted-foreground
          ">
            <FileText
              size={32}
              className="
                mx-auto
                mb-3
                opacity-40
              "
            />

            <p className="text-sm">
              No installation reports found.
            </p>
          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="
              w-full
              text-sm
            ">

              <thead>
                <tr className="
                  border-b
                  border-border
                  bg-muted/30
                ">

                  <th className="
                    px-4
                    py-3
                    text-left
                    text-xs
                    font-medium
                    text-muted-foreground
                  ">
                    Report No.
                  </th>

                  <th className="
                    px-4
                    py-3
                    text-left
                    text-xs
                    font-medium
                    text-muted-foreground
                  ">
                    Type
                  </th>

                  <th className="
                    px-4
                    py-3
                    text-left
                    text-xs
                    font-medium
                    text-muted-foreground
                  ">
                    DO No.
                  </th>

                  <th className="
                    px-4
                    py-3
                    text-left
                    text-xs
                    font-medium
                    text-muted-foreground
                  ">
                    Client
                  </th>

                  <th className="
                    px-4
                    py-3
                    text-left
                    text-xs
                    font-medium
                    text-muted-foreground
                  ">
                    Site
                  </th>

                  <th className="
                    px-4
                    py-3
                    text-left
                    text-xs
                    font-medium
                    text-muted-foreground
                  ">
                    Date
                  </th>

                  <th className="
                    px-4
                    py-3
                    text-left
                    text-xs
                    font-medium
                    text-muted-foreground
                  ">
                    Technician
                  </th>

                  <th className="
                    px-4
                    py-3
                    text-left
                    text-xs
                    font-medium
                    text-muted-foreground
                  ">
                    Status
                  </th>

                </tr>
              </thead>


              <tbody>
                {filteredReports.map((report) => {

                  const status =
                    STATUS_CONFIG[report.status] ||
                    STATUS_CONFIG.pending;


                  const type =
                    TYPE_CONFIG[report.report_type] ||
                    TYPE_CONFIG.commissioning;


                  const displayDate =
                    report.installation_date ||
                    report.scheduled_date ||
                    report.created_date;


                  return (
                    <tr
                      key={report.id}
                      className="
                        border-b
                        border-border
                        last:border-b-0
                        hover:bg-muted/30
                        transition-colors
                      "
                    >

                      {/* =========================
                          IMPORTANT TEST LINK
                      ========================== */}
                      <td className="
                        px-4
                        py-3
                      ">

                        <Link
                          to={`/installation-pdf-test/${report.id}`}
                          className="
                            font-mono
                            font-medium
                            text-primary
                            hover:underline
                          "
                        >
                          {report.report_number || '—'}
                        </Link>

                      </td>


                      <td className="
                        px-4
                        py-3
                      ">
                        <Badge
                          variant="outline"
                          className={
                            `text-[10px] ${type.className}`
                          }
                        >
                          {type.label}
                        </Badge>
                      </td>


                      <td className="
                        px-4
                        py-3
                        font-mono
                        text-xs
                      ">
                        {report.do_number || '—'}
                      </td>


                      <td className="
                        px-4
                        py-3
                      ">
                        {report.client_name || '—'}
                      </td>


                      <td className="
                        px-4
                        py-3
                      ">
                        <div>
                          <p>
                            {report.site_name || '—'}
                          </p>

                          {report.site_location && (
                            <p className="
                              text-xs
                              text-muted-foreground
                              mt-0.5
                            ">
                              {report.site_location}
                            </p>
                          )}
                        </div>
                      </td>


                      <td className="
                        px-4
                        py-3
                        whitespace-nowrap
                      ">
                        {displayDate
                          ? new Date(displayDate)
                              .toLocaleDateString()
                          : '—'}
                      </td>


                      <td className="
                        px-4
                        py-3
                      ">
                        {report.attended_staff_name || '—'}
                      </td>


                      <td className="
                        px-4
                        py-3
                      ">
                        <Badge
                          variant="outline"
                          className={
                            `text-[10px] ${status.className}`
                          }
                        >
                          {status.label}
                        </Badge>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>

          </div>

        )}

      </div>


      {/* RESULT COUNT */}
      {!isLoading && (
        <p className="
          text-xs
          text-muted-foreground
        ">
          Showing {filteredReports.length} of {reports.length} reports
        </p>
      )}

    </div>
  );
}