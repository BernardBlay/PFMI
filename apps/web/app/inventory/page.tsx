"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface Part {
  id: string;
  name: string;
  category: string;
  partNumber: string;
  supplier: string;
  shelf: string;
  quantity: number;
  reorderLevel: number;
  status: "in-stock" | "low-stock" | "out-of-stock";
  icon: string;
}

const mockParts: Part[] = [
  {
    id: "1",
    name: "V-Belt B84",
    category: "Belts & Drives",
    partNumber: "BLT-VBX-B84",
    supplier: "Gates Australia",
    shelf: "Shelf C2",
    quantity: 0,
    reorderLevel: 5,
    status: "out-of-stock",
    icon: "🔧",
  },
  {
    id: "2",
    name: "Deep Groove Ball Bearing 6205",
    category: "Bearings",
    partNumber: "BRG-SKF-6205",
    supplier: "SKF Australia",
    shelf: "Shelf B3",
    quantity: 3,
    reorderLevel: 10,
    status: "low-stock",
    icon: "⚙️",
  },
  {
    id: "3",
    name: "Hydraulic Pump Seal Kit",
    category: "Seals & Gaskets",
    partNumber: "SL-HYD-PK01",
    supplier: "Parker Hannifin",
    shelf: "Shelf A1",
    quantity: 12,
    reorderLevel: 5,
    status: "in-stock",
    icon: "🔩",
  },
  {
    id: "4",
    name: "Motor Coupling Flex",
    category: "Couplings",
    partNumber: "CPL-FLX-M50",
    supplier: "Regal Rexnord",
    shelf: "Shelf D4",
    quantity: 0,
    reorderLevel: 3,
    status: "out-of-stock",
    icon: "🔗",
  },
  {
    id: "5",
    name: "Conveyor Belt Splice",
    category: "Belts & Drives",
    partNumber: "BLT-SPL-36K",
    supplier: "Beltservice",
    shelf: "Shelf C3",
    quantity: 5,
    reorderLevel: 8,
    status: "in-stock",
    icon: "📦",
  },
];

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<"catalogue" | "orders">("catalogue");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState("all");

  const filteredParts = mockParts.filter((part) => {
    const matchesSearch =
      part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.supplier.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = filterCategory === "all" || part.category === filterCategory;

    const matchesStock =
      filterStock === "all" ||
      (filterStock === "in-stock" && part.status === "in-stock") ||
      (filterStock === "low-stock" && part.status === "low-stock") ||
      (filterStock === "out-of-stock" && part.status === "out-of-stock");

    return matchesSearch && matchesCategory && matchesStock;
  });

  const stats = [
    { label: "Total Parts", value: mockParts.length, color: "text-[var(--accent-light)]" },
    {
      label: "Out of Stock",
      value: mockParts.filter((p) => p.status === "out-of-stock").length,
      color: "text-red-400",
    },
    {
      label: "Low Stock",
      value: mockParts.filter((p) => p.status === "low-stock").length,
      color: "text-amber-400",
    },
    {
      label: "Active Orders",
      value: 2,
      color: "text-blue-400",
    },
  ];

  const categories = ["all", ...new Set(mockParts.map((p) => p.category))];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in-stock":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            In Stock
          </span>
        );
      case "low-stock":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Low Stock
          </span>
        );
      case "out-of-stock":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Out of Stock
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar />
      <div className="container mx-auto px-6 py-24 flex-1">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold mb-2">Parts Inventory</h1>
            <p className="text-[var(--text-secondary)]">{mockParts.length} parts tracked</p>
          </div>
          <button className="mt-4 md:mt-0 px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-[rgba(245,158,11,0.3)] transition-all">
            + Add Part
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="p-6 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
            >
              <p className="text-[var(--text-secondary)] text-sm font-medium mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-8 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab("catalogue")}
            className={`px-6 py-3 font-semibold text-sm transition-all ${
              activeTab === "catalogue"
                ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Parts Catalogue
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-6 py-3 font-semibold text-sm transition-all relative ${
              activeTab === "orders"
                ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Order Requests
            <span className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 text-white text-xs rounded-full flex items-center justify-center">
              2
            </span>
          </button>
        </div>

        {activeTab === "catalogue" && (
          <>
            {/* Search and Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="relative md:col-span-1">
                <svg
                  className="absolute left-3 top-3.5 w-5 h-5 text-[var(--text-muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, part number, supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>

              <select
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
                className="px-4 py-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] transition-colors"
              >
                <option value="all">All Stock Levels</option>
                <option value="in-stock">In Stock</option>
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] transition-colors"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "all" ? "All" : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Parts List */}
            <div className="space-y-4">
              {filteredParts.length > 0 ? (
                filteredParts.map((part) => (
                  <div
                    key={part.id}
                    className="p-6 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all hover:shadow-lg group cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="text-3xl">{part.icon}</div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-[var(--text-primary)]">{part.name}</h3>
                          <div className="flex flex-wrap gap-2 mt-2 text-sm">
                            <span className="text-[var(--text-muted)]">{part.category}</span>
                            <span className="text-[var(--text-muted)]">•</span>
                            <span className="font-mono text-[var(--accent)]">{part.partNumber}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(part.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-[var(--text-muted)] mb-1">Supplier</p>
                        <p className="font-medium">{part.supplier}</p>
                      </div>
                      <div>
                        <p className="text-[var(--text-muted)] mb-1">Location</p>
                        <p className="font-medium">{part.shelf}</p>
                      </div>
                      <div>
                        <p className="text-[var(--text-muted)] mb-1">Quantity</p>
                        <p className="font-bold text-lg">{part.quantity}</p>
                      </div>
                      <div>
                        <p className="text-[var(--text-muted)] mb-1">Reorder Level</p>
                        <p className="font-medium">{part.reorderLevel}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            part.status === "in-stock"
                              ? "bg-green-500"
                              : part.status === "low-stock"
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min((part.quantity / part.reorderLevel) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">
                        {Math.round((part.quantity / part.reorderLevel) * 100)}%
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
                  <p className="text-[var(--text-muted)]">No parts found matching your filters</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "orders" && (
          <div className="p-12 text-center rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
            <p className="text-2xl font-bold mb-2">Order Requests</p>
            <p className="text-[var(--text-muted)]">2 pending orders</p>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
