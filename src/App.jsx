import * as React from "react";
import { Box, Chip, Paper, Stack, Typography, Button, TextField, MenuItem } from "@mui/material";
// DataGridPro for main table, GridToolBar for  search/export/column toggling, etc
import { DataGridPro, GridToolbar } from "@mui/x-data-grid-pro";

/*
  BRC-style Invoice Grid (MUI Pro)
  - Add invoice (simple form)
  - Delete selected invoices (bulk delete)
  - paginationModel
  - server-like filtering/sorting/paging (simulated in memory)
*/
function formatEUR(value) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function issueDate(field) { //used by sorting function
  return field === "issueDate" || field === "dueDate";
}

function overdueCalc(aISO, bISO) {
  const a = new Date(aISO); 
  const b = new Date(bISO);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ISO 8601 date formatting standard YYYY-MM-DD
const TODAY_ISO = new Date().toISOString().slice(0, 10); //store today as an ISO string for comparison

// Simulate getting invoice data from backend/database
const INITIAL_ROWS = [
  { id: 1, invoiceNo: "INV-10021", customer: "JJ Smith Ltd", issueDate: "2026-02-01", dueDate: "2026-02-15", status: "Unpaid", total: 1200.0 },
  { id: 2, invoiceNo: "INV-10022", customer: "Brew Cafe", issueDate: "2026-02-20", dueDate: "2026-03-05", status: "Paid", total: 420.5 },
  { id: 3, invoiceNo: "INV-10023", customer: "Office Supplies Co.", issueDate: "2026-01-10", dueDate: "2026-01-24", status: "Unpaid", total: 3200.0 },
  { id: 4, invoiceNo: "INV-10024", customer: "I.T Repairs", issueDate: "2025-12-01", dueDate: "2025-12-15", status: "Unpaid", total: 980.0 },
  { id: 5, invoiceNo: "INV-10025", customer: "AJ Accounting", issueDate: "2026-03-01", dueDate: "2026-03-31", status: "Draft", total: 150.0 },
  { id: 6, invoiceNo: "INV-10026", customer: "Brew Cafe", issueDate: "2026-02-14", dueDate: "2026-02-28", status: "Unpaid", total: 860.0 },
];

function computeInvoiceFields(r) {
  //compare todays date (TODAY_ISO) to the payments dueDate
  //Math.max(0,...) ensures negative values aren't shown
  const overdueDays = r.status !== "Paid" ? Math.max(0, -overdueCalc(TODAY_ISO, r.dueDate)) : 0;
  const computedStatus = r.status === "Unpaid" && overdueDays > 0 ? "Overdue" : r.status;

  //return original row plus these newly calculated fields
  return { ...r, status: computedStatus, overdueDays, period: r.issueDate.slice(0, 7) };
}

function StatusBadge({ value }) {
  let color = "default";
  if (value === "Paid") color = "success";
  else if (value === "Unpaid") color = "warning";
  else if (value === "Overdue") color = "error";
  else if (value === "Draft") color = "info";
  return <Chip size="small" label={value} color={color} variant="outlined" />;
}

// Quick search filter from DataGrid 
// search invoice number, customer name, status
function applyQuickFilter(data, quickValues) { 
  const q = (quickValues || []).join(" ").trim().toLowerCase(); //convert to lowercase to make the seach case-senstive
  if (!q) return data; //if the user doesn't search anything, just return the default data
  return data.filter((r) => r.invoiceNo.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q) || r.status.toLowerCase().includes(q));
}

function applyColumnFilters(data, filterModel) {
  const items = filterModel?.items || []; //array of filter items
  let out = data; //start with full dataset
  for (const i of items) { //go through all the filters
    if (!i.field || i.value == null || String(i.value).trim() === "") continue; //skip invalid filters
    const value = String(i.value).toLowerCase(); //make the filter lowercase for case-sensitive matching
    out = out.filter((r) => { //apply filter
      const cell = r[i.field]; //read the in each row for the field that is being filtered
      if (cell == null) return false; //if there is no value in the field
      return String(cell).toLowerCase().includes(value); //convert the cells contents to a string & check it matches the filter
    });
  }
  return out; //return the dataset after column filtering
}

//Simulate server sorting locally
function applySortingModel(data, sortModel) {
  if (!sortModel || sortModel.length === 0) return data;
  const { field, sort } = sortModel[0]; //MUI can have multiple sorts, use the first one
  const dir = sort === "desc" ? -1 : 1;

  const sorted = [...data].sort((a, b) => {
    //pull values from the 2 rows for the sort field
    const av = a[field];
    const bv = b[field];

    if (issueDate(field)) {
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    }

    //if bothe values are numbers compare them numerically
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;

    const ac = String(av ?? "").toLowerCase();
    const bc = String(bv ?? "").toLowerCase();
    if (ac === bc) return 0;
    return ac > bc ? dir : -dir;
  });

  return sorted;
}

function nextId(rows){
  //find largest invoice ID number currently
  const max=rows.reduce((m,r) => Math.max(m,Number(r.id) || 0),0);
  return max+1; //return the next available id
}

// MAIN 
export default function App() {
  // map invoices list to table
  const [invoices, setInvoices] = React.useState(() => INITIAL_ROWS.map(computeInvoiceFields));

  // Selected rows for deletion
  const [selectionModel, setSelectionModel] = React.useState([]);

  // MUI v6 pagination model
  //page 0 is the default page that open on window load
  const [paginationModel, setPaginationModel] = React.useState({ page: 0, pageSize: 10 });

  // Server-like sort/filter models (applied locally)
  const [sortModel, setSortModel] = React.useState([{ field: "dueDate", sort: "asc" }]);
  const [filterModel, setFilterModel] = React.useState({ items: [], quickFilterValues: [] });

  // Reset to page 0 when query changes (common server behavior)
  React.useEffect(() => {
    setPaginationModel((m) => ({ ...m, page: 0 }));
  }, [sortModel, filterModel]);

  // Add invoice form state
  const [form, setForm] = React.useState({
    invoiceNo: "INV-",
    customer: "",
    issueDate: TODAY_ISO,
    dueDate: TODAY_ISO,
    status: "Unpaid",
    total: "",
  });

  const columns = React.useMemo( //memo stabilises the grid and prevents unnecessary re-renders
    () => [
      { field: "invoiceNo", headerName: "Invoice No", width: 140 },
      { field: "customer", headerName: "Customer", width: 220, flex: 1, minWidth: 200 },
      { field: "status", headerName: "Status", width: 140, renderCell: (params) => <StatusBadge value={params.value} /> },
      { field: "issueDate", headerName: "Issue Date", width: 120 },
      { field: "dueDate", headerName: "Due Date", width: 120 },
      { field: "overdueDays", headerName: "Overdue (days)", type: "number", width: 140 },
      { field: "total", headerName: "Total", type: "number", width: 140, valueFormatter: (params) => formatEUR(params.value) },
      { field: "period", headerName: "Period", width: 110 },
    ],
    []
  );

  // In-memory server simulation
  // similiar to how the grid would operateif interacting with an API
  const { rows, rowCount, totals } = React.useMemo(() => {
    let data = [...invoices];

    data = applyQuickFilter(data, filterModel.quickFilterValues);
    data = applyColumnFilters(data, filterModel);
    data = applySortingModel(data, sortModel);

    const totalCount = data.length; // for pagination

    const totalBilled = data.reduce((acc, r) => acc + Number(r.total || 0), 0);
    const totalOverdue = data.filter((r) => r.status === "Overdue").reduce((acc, r) => acc + Number(r.total || 0), 0);
    const totalUnpaid = data.filter((r) => r.status === "Unpaid" || r.status === "Overdue").reduce((acc, r) => acc + Number(r.total || 0), 0);

    //which rows should be shown for the current page
    const start = paginationModel.page * paginationModel.pageSize;
    const end = start + paginationModel.pageSize;
    const pageRows = data.slice(start, end); //return the correct rows

    return {
      rows: pageRows,
      rowCount: totalCount,
      totals: { totalBilled, totalUnpaid, totalOverdue },
    };
  }, [invoices, filterModel, sortModel, paginationModel]);

  function handleAddInvoice() {
    // Basic validation
    if (!form.customer.trim()) {
      alert("Enter a customer name.");
      return;
    }
    if (!form.invoiceNo.trim() || !form.invoiceNo.startsWith("INV-")) {
      alert("Enter an invoice number starting with INV-");
      return;
    }
    const totalNumber = Number(form.total);
    if (Number.isNaN(totalNumber) || totalNumber <= 0) {
      alert("Enter a valid total amount.");
      return;
    }

    //build the new invoice row so it behaves like its predecessors
    const newInvoice = computeInvoiceFields({
      id: nextId(invoices),
      invoiceNo: form.invoiceNo.trim(),
      customer: form.customer.trim(),
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      status: form.status,
      total: totalNumber,
    });

    setInvoices((prev) => [newInvoice, ...prev]); //insert at the top of list, above previous invoices
    
    // Clear form for the next entry
    setForm((prev) => ({
      ...prev,
      invoiceNo: "INV-",
      customer: "",
      status: "Unpaid",
      total: "",
    }));
  }

  //Delete the selected invoices
  function handleDeleteSelected() {
    if (selectionModel.length === 0) {
      alert("Select one or more invoices to delete.");
      return;
    }

    const ok = confirm(`Delete ${selectionModel.length} invoice(s)?`);
    if (!ok) return;

    //remove the selected invoice ids from the array
    setInvoices((prev) => prev.filter((r) => !selectionModel.includes(r.id)));
    setSelectionModel([]); //clear selection after deletion
  }

  //Render the full page
  return (
    <Box sx={{ p: 3, maxWidth: 1500, mx: "auto" }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        BRC Invoice Grid Demo (MUI X DataGridPro)
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.85, mb: 2 }}>
        Demonstrates invoice management: view, search, filter, sort, paginate, add invoices, and delete selected invoices.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip label={`Total billed: ${formatEUR(totals.totalBilled)}`} variant="outlined" />
          <Chip label={`Unpaid: ${formatEUR(totals.totalUnpaid)}`} color="warning" variant="outlined" />
          <Chip label={`Overdue: ${formatEUR(totals.totalOverdue)}`} color="error" variant="outlined" />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Add Invoice (demo)
        </Typography>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap">
          <TextField
            label="Invoice No"
            size="small"
            value={form.invoiceNo}
            onChange={(e) => setForm((p) => ({ ...p, invoiceNo: e.target.value }))}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="Customer"
            size="small"
            value={form.customer}
            onChange={(e) => setForm((p) => ({ ...p, customer: e.target.value }))}
            sx={{ minWidth: 220, flex: 1 }}
          />
          <TextField
            label="Issue Date"
            size="small"
            type="date"
            value={form.issueDate}
            onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="Due Date"
            size="small"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            select
            label="Status"
            size="small"
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="Draft">Draft</MenuItem>
            <MenuItem value="Unpaid">Unpaid</MenuItem>
            <MenuItem value="Paid">Paid</MenuItem>
          </TextField>
          <TextField
            label="Total (EUR)"
            size="small"
            value={form.total}
            onChange={(e) => setForm((p) => ({ ...p, total: e.target.value }))}
            sx={{ minWidth: 140 }}
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="contained" onClick={handleAddInvoice}>
              Add
            </Button>
            <Button variant="outlined" color="error" onClick={handleDeleteSelected}>
              Delete selected
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ height: 560 }}>
        <DataGridPro
          rows={rows}
          columns={columns}
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={(m) => setSelectionModel(m)}

          // Server modes (simulated)
          pagination
          paginationMode="server"
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[5, 10, 25, 50]}

          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={setSortModel}

          filterMode="server"
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}

          // Toolbar with quick filter/export/etc.
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
            },
          }}

          // Keep key columns visible like a finance system
          initialState={{
            pinnedColumns: { left: ["invoiceNo", "customer"] },
          }}

          // Visual cue for overdue rows
          getRowClassName={(params) => (params.row.status === "Overdue" ? "row-overdue" : "")}
          density="compact"
        />
      </Paper>

      <style>
        {`
          .row-overdue {
            background: rgba(255, 0, 0, 0.06);
          }
        `}
      </style>
    </Box>
  );
}
