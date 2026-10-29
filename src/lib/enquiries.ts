export const enquiryStates = {
  new: { label: "Received", description: "Waiting for staff review. No space is held." },
  reviewing: {
    label: "Under review",
    description: "Staff are reviewing your requirements. Check back here for progress.",
  },
  quoted: {
    label: "Quote prepared",
    description:
      "Review your rental quotes below. A quote may expire or be superseded; check its current status before accepting.",
  },
  closed: {
    label: "Closed",
    description:
      "Staff have closed this enquiry. Existing quotes and reservations keep their own status. Send a new enquiry if you need something else.",
  },
} as const;
