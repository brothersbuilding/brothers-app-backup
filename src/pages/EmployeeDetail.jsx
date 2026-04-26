import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Save, Plus, Trash2, X, Upload, ChevronDown, Calendar } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, isPast, parseISO } from "date-fns";

const getInitials = (name) => {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
};

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
const PONCHO_SIZES = ["S/M", "L/XL", "2XL/3XL"];

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useOutletContext();
  const isNew = id === "new";

  const { data: employee } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      if (isNew) return null;
      const emps = await base44.entities.Employee.list();
      return emps.find((e) => e.id === id) || null;
    },
    enabled: !isNew && user?.role === "admin",
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list("-updated_date", 500),
    enabled: user?.role === "admin",
  });

  const [formData, setFormData] = useState({
    full_name: "",
    dob: "",
    phone: "",
    email: "",
    job_title: "",
    permission_level: "labor",
    supervisors: [],
    salary_rates: [],
    hourly_rates: [],
    certifications: [],
    shirt_size: "",
    poncho_size: "",
    profile_photo: "",
  });

  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [supervisorOpen, setSupervisorOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
   salaryRates: false,
   hourlyRates: false,
   certifications: false,
  });

  const formatPhoneNumber = (value) => {
   const digits = value.replace(/\D/g, "");
   if (digits.length <= 3) return digits;
   if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
   return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      navigate("/employees");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      navigate("/employees");
    },
  });

  useEffect(() => {
    if (employee) {
      setFormData(employee);
    }
  }, [employee]);

  // Admin-only check
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Access restricted to admins only</p>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isNew) {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate(formData);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, profile_photo: file_url });
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleAddSalaryRate = () => {
    setFormData({
      ...formData,
      salary_rates: [...(formData.salary_rates || []), { label: "", annual_amount: 0 }],
    });
  };

  const handleAddHourlyRate = () => {
    setFormData({
      ...formData,
      hourly_rates: [...(formData.hourly_rates || []), { pay_type_label: "", hourly_amount: 0 }],
    });
  };

  const handleAddCertification = () => {
    setFormData({
      ...formData,
      certifications: [...(formData.certifications || []), { name: "", issuing_body: "", expiration_date: "", document_url: "" }],
    });
  };

  const handleRemoveSupervisor = (supervisorId) => {
    setFormData({
      ...formData,
      supervisors: formData.supervisors.filter((s) => s.id !== supervisorId),
    });
  };

  const availableSupervisors = allEmployees.filter(
    (emp) => emp.id !== id && !formData.supervisors.some((s) => s.id === emp.id)
  );

  const filteredSupervisors = availableSupervisors.filter((emp) =>
    (emp.full_name || "").toLowerCase().includes(supervisorSearch.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/employees" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">
            {isNew ? "New Employee" : "Employee Profile"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{!isNew && formData.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Section */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Profile Photo</h2>
          <div className="flex items-end gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={formData.profile_photo} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {getInitials(formData.full_name)}
              </AvatarFallback>
            </Avatar>
            <label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button type="button" variant="outline" className="gap-2" asChild>
                <span>
                  <Upload className="w-4 h-4" /> Upload Photo
                </span>
              </Button>
            </label>
          </div>
        </Card>

        {/* Personal Info */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Full Name</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date of Birth</Label>
                <Input
                  type="text"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  placeholder="MM/DD/YYYY"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
                  placeholder="XXX-XXX-XXXX"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Job Title</Label>
                <Input
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  placeholder="Job title"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Permission Level</Label>
                <Select value={formData.permission_level} onValueChange={(v) => setFormData({ ...formData, permission_level: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Supervisors */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Supervisors</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.supervisors?.map((supervisor) => (
                  <Badge key={supervisor.id} variant="secondary" className="gap-1 px-2 py-1">
                    {supervisor.full_name}
                    <button
                      type="button"
                      onClick={() => handleRemoveSupervisor(supervisor.id)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Popover open={supervisorOpen} onOpenChange={setSupervisorOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className="w-full justify-start">
                    + Add Supervisor
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search supervisors..."
                      value={supervisorSearch}
                      onValueChange={setSupervisorSearch}
                    />
                    <CommandEmpty>No supervisors available.</CommandEmpty>
                    <CommandGroup>
                      {filteredSupervisors.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          value={emp.full_name}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              supervisors: [...formData.supervisors, { id: emp.id, full_name: emp.full_name }],
                            });
                            setSupervisorOpen(false);
                            setSupervisorSearch("");
                          }}
                          className="cursor-pointer"
                        >
                          {emp.full_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </Card>

        {/* Pay Rates */}
        <Card className="p-6">
          <button
            type="button"
            onClick={() =>
              setExpandedSections({ ...expandedSections, salaryRates: !expandedSections.salaryRates })
            }
            className="flex items-center justify-between w-full mb-4"
          >
            <h2 className="text-lg font-semibold">Salary Rates</h2>
            <ChevronDown
              className={`w-5 h-5 transition-transform ${expandedSections.salaryRates ? "rotate-180" : ""}`}
            />
          </button>
          {expandedSections.salaryRates && (
            <div className="space-y-3">
              {formData.salary_rates?.map((rate, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={rate.label}
                      onChange={(e) => {
                        const updated = [...formData.salary_rates];
                        updated[idx].label = e.target.value;
                        setFormData({ ...formData, salary_rates: updated });
                      }}
                      placeholder="e.g. Base Salary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Annual Amount ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rate.annual_amount}
                      onChange={(e) => {
                        const updated = [...formData.salary_rates];
                        updated[idx].annual_amount = Number(e.target.value);
                        setFormData({ ...formData, salary_rates: updated });
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        salary_rates: formData.salary_rates.filter((_, i) => i !== idx),
                      });
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full gap-2" onClick={handleAddSalaryRate}>
                <Plus className="w-4 h-4" /> Add Salary Rate
              </Button>
            </div>
          )}
        </Card>

        {/* Hourly Rates */}
        <Card className="p-6">
          <button
            type="button"
            onClick={() =>
              setExpandedSections({ ...expandedSections, hourlyRates: !expandedSections.hourlyRates })
            }
            className="flex items-center justify-between w-full mb-4"
          >
            <h2 className="text-lg font-semibold">Hourly Rates</h2>
            <ChevronDown
              className={`w-5 h-5 transition-transform ${expandedSections.hourlyRates ? "rotate-180" : ""}`}
            />
          </button>
          {expandedSections.hourlyRates && (
            <div className="space-y-3">
              {formData.hourly_rates?.map((rate, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pay Type</Label>
                    <Input
                      value={rate.pay_type_label}
                      onChange={(e) => {
                        const updated = [...formData.hourly_rates];
                        updated[idx].pay_type_label = e.target.value;
                        setFormData({ ...formData, hourly_rates: updated });
                      }}
                      placeholder="e.g. Regular"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hourly Amount ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rate.hourly_amount}
                      onChange={(e) => {
                        const updated = [...formData.hourly_rates];
                        updated[idx].hourly_amount = Number(e.target.value);
                        setFormData({ ...formData, hourly_rates: updated });
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        hourly_rates: formData.hourly_rates.filter((_, i) => i !== idx),
                      });
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full gap-2" onClick={handleAddHourlyRate}>
                <Plus className="w-4 h-4" /> Add Hourly Rate
              </Button>
            </div>
          )}
        </Card>

        {/* Certifications */}
        <Card className="p-6">
          <button
            type="button"
            onClick={() =>
              setExpandedSections({
                ...expandedSections,
                certifications: !expandedSections.certifications,
              })
            }
            className="flex items-center justify-between w-full mb-4"
          >
            <h2 className="text-lg font-semibold">Certifications/Licenses</h2>
            <ChevronDown
              className={`w-5 h-5 transition-transform ${expandedSections.certifications ? "rotate-180" : ""}`}
            />
          </button>
          {expandedSections.certifications && (
            <div className="space-y-4">
              {formData.certifications?.map((cert, idx) => (
                <Card key={idx} className="p-4 bg-muted/30">
                  <div className="flex justify-end mb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          certifications: formData.certifications.filter((_, i) => i !== idx),
                        });
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Certification Name</Label>
                      <Input
                        value={cert.name}
                        onChange={(e) => {
                          const updated = [...formData.certifications];
                          updated[idx].name = e.target.value;
                          setFormData({ ...formData, certifications: updated });
                        }}
                        placeholder="e.g. CPR Certification"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Issuing Body</Label>
                      <Input
                        value={cert.issuing_body}
                        onChange={(e) => {
                          const updated = [...formData.certifications];
                          updated[idx].issuing_body = e.target.value;
                          setFormData({ ...formData, certifications: updated });
                        }}
                        placeholder="e.g. American Red Cross"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Expiration Date</Label>
                        <Input
                          type="date"
                          value={cert.expiration_date}
                          onChange={(e) => {
                            const updated = [...formData.certifications];
                            updated[idx].expiration_date = e.target.value;
                            setFormData({ ...formData, certifications: updated });
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Document</Label>
                        <label>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.png"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                const updated = [...formData.certifications];
                                updated[idx].document_url = file_url;
                                setFormData({ ...formData, certifications: updated });
                              } catch (error) {
                                console.error("Upload failed:", error);
                              }
                            }}
                            className="hidden"
                          />
                          <Button type="button" variant="outline" className="w-full gap-2" asChild>
                            <span>
                              <Upload className="w-4 h-4" /> {cert.document_url ? "Update" : "Upload"}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              <Button type="button" variant="outline" className="w-full gap-2" onClick={handleAddCertification}>
                <Plus className="w-4 h-4" /> Add Certification
              </Button>
            </div>
          )}
        </Card>

        {/* Sizing */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Sizing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Shirt Size</Label>
              <Select value={formData.shirt_size} onValueChange={(v) => setFormData({ ...formData, shirt_size: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {SHIRT_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Poncho Size</Label>
              <Select value={formData.poncho_size} onValueChange={(v) => setFormData({ ...formData, poncho_size: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {PONCHO_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex gap-3 justify-end pb-32">
          <Button type="button" variant="outline" onClick={() => navigate("/employees")}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="gap-2">
            <Save className="w-4 h-4" /> {isNew ? "Create Employee" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}