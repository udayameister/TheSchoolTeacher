# Verify before launch

Seeded values that are official facts or business decisions. None of them were invented as
authoritative; each one must be checked against the official source and then confirmed in
**Admin → Master data** (open the item, correct it if needed, untick "Needs verification").
The admin dashboard shows how many items still carry the **VERIFY** flag.

| List | What to check | Where to check |
|---|---|---|
| Boards & affiliations | Each state board's current official name and acronym (several were renamed or merged recently, e.g. Assam's SEBA/AHSEC → ASSEB, Telangana TSBIE/TGBIE naming). Add boards for states/UTs not seeded (Sikkim, Arunachal, UTs that follow CBSE). Fill in official websites. | Each board's official website / state education department |
| Teacher Eligibility Tests | Name, conducting body, papers, and **certificate validity** of every TET. CTET is seeded as "Lifetime (NCTE decision, 2021)": confirm. State TET validity varies by state; the field is empty until checked. Add exams that are missing. | NCTE notifications; ctet.nic.in; each state's TET notification |
| 7th CPC pay levels | Entry basic pay of levels 1–14 (seeded from the central pay matrix) and the post → level mapping (PRT L6, TGT/Librarian L7, PGT L8, Vice Principal L10, Principal L12, as in KVS). | 7th CPC pay matrix; latest KVS / NVS recruitment notifications |
| School subscription categories | **All prices are placeholders (₹0).** Set the annual price and branches per category. | Business decision |
| States & UTs | 28 states + 8 UTs as of the seed date; Hindi names; **UDISE+ code prefixes** (seeded from the Census 2011 state codes, e.g. AP 28/37, Telangana 36; Ladakh left empty). The prefix only produces a warning, never a refusal. | Government of India / LGD; a few known UDISE+ codes per state |
| UDISE+ directory | Not seeded. Import the school directory as CSV (Admin → UDISE+ directory) so registrations can be matched. | UDISE+ reports (udiseplus.gov.in) |
| Districts, blocks | **Not seeded.** Import from the Local Government Directory as CSV (Admin → Master data → Districts → Import CSV; columns `code,name,nameHi,parentCode,lgdCode`, where `parentCode` is the state code such as `AP`). | lgdirectory.gov.in |
| Suggested import sources | NVS, KVS, CBSE, AWES, TN TRB, BPSC and AP DSC addresses (Admin → Import sources → Suggested). Each is added switched off with a VERIFY badge: open it, replace a home page with the exact recruitment / notices page where one exists (KVS, CBSE), run it once and check the queue, then switch it on. | The official sites |
| Legal pages | Terms, Privacy, Refund policy are drafts and show a "Draft" notice. Name a Grievance Officer (DPDP Act). | A lawyer |
| Contact address | `CONTACT_EMAIL` defaults to info@theschoolteacher.in. | Your mailbox |

Not flagged (product settings, not facts): match-score weights (35/25/15/10/10/5, cap 49%) and
selection-panel weights (30/30/20/20), as suggested in the build spec. Change them any time.
