"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import "./overrides.css";

type Role = "student" | "organizer";
type User = { name: string; email: string; role: Role; phone?: string | null; department?: string | null; semester?: string | null };
type Event = { id: number; title: string; category: string; date: string; location: string; description: string; seats: number; registered: number; requiresPayment: boolean; paymentAmount: number | null; bannerImage: string | null };
type Participant = { id: number; fullName: string; email: string; phone: string | null; department: string | null; semester: string | null; notes: string | null; paymentProof: string | null };
type Modal = "login" | "signup" | "create" | "edit" | "register" | "participants" | "settings" | null;

const categories = ["All events", "Academic", "Sports", "Culture", "Workshop"];
const colors = ["blue", "green", "orange", "purple"];

function eventDate(date: string) {
  const value = new Date(date);
  return `${value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

async function responseError(response: Response) {
  const data = await response.json().catch(() => ({}));
  return data.error || "Something went wrong. Please try again.";
}

async function readImageFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > 3 * 1024 * 1024) throw new Error("Poster image must be smaller than 3 MB.");
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(value); });
}

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [activeCategory, setActiveCategory] = useState("All events");
  const [search, setSearch] = useState("");
  const [registeredIds, setRegisteredIds] = useState<number[]>([]);
  const [view, setView] = useState<"student" | "organizer">("student");
  const [user, setUser] = useState<User | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsEvent, setParticipantsEvent] = useState<Event | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [eventsResponse, sessionResponse] = await Promise.all([fetch("/api/events"), fetch("/api/auth/session")]);
    const eventsData = await eventsResponse.json();
    const sessionData = await sessionResponse.json();
    setEvents(eventsData.events ?? []);
    setUser(sessionData.user ?? null);
    setRegisteredIds(sessionData.registeredIds ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (modal !== "create" && modal !== "edit") return;
    const form = document.querySelector('form input[name="title"]')?.closest("form");
    if (!form || form.querySelector('[name="bannerImage"]')) return;
    const label = document.createElement("label");
    label.textContent = "Poster image";
    const input = document.createElement("input");
    input.name = "bannerImage";
    input.type = "file";
    input.accept = "image/*";
    const hint = document.createElement("small");
    hint.textContent = "PNG/JPG, maximum 3 MB.";
    label.append(input, hint);
    form.querySelector('textarea[name="description"]')?.parentElement?.after(label);
    return () => label.remove();
  }, [modal]);

  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesCategory = activeCategory === "All events" || event.category === activeCategory;
    return matchesCategory && `${event.title} ${event.location}`.toLowerCase().includes(search.toLowerCase());
  }), [activeCategory, events, search]);

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>("[class*='cardArt']");
    cards.forEach((card, index) => {
      const banner = filteredEvents[index]?.bannerImage;
      if (banner) {
        card.style.backgroundImage = `linear-gradient(135deg, rgba(8,44,59,.24), rgba(8,44,59,.48)), url(${banner})`;
        card.style.backgroundSize = "cover";
        card.style.backgroundPosition = "center";
      }
    });
  }, [filteredEvents]);

  function startRegistration(event: Event) {
    if (!user) { setMessage("Sign in with your university account before registering."); setModal("login"); return; }
    if (user.role !== "student") { setMessage("Only student accounts can register for events."); return; }
    if (registeredIds.includes(event.id)) { setMessage("You are already registered for this event."); return; }
    if (event.seats - event.registered <= 0) { setMessage("This event is fully booked."); return; }
    setSelectedEvent(event); setModal("register");
  }

  async function register(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!selectedEvent) return;
    const form = new FormData(formEvent.currentTarget);
    const proofFile = form.get("paymentProof");
    let paymentProof = "";
    if (proofFile instanceof File && proofFile.size > 0) {
      if (proofFile.size > 2 * 1024 * 1024) { setMessage("Payment proof must be smaller than 2 MB."); return; }
      paymentProof = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(proofFile); });
    }
    const response = await fetch("/api/registrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: selectedEvent.id, fullName: form.get("fullName"), phone: form.get("phone"), department: form.get("department"), semester: form.get("semester"), notes: form.get("notes"), paymentProof }) });
    if (!response.ok) { setMessage(await responseError(response)); return; }
    setRegisteredIds((ids) => [...ids, selectedEvent.id]);
    setEvents((items) => items.map((item) => item.id === selectedEvent.id ? { ...item, registered: item.registered + 1 } : item));
    setSelectedEvent(null); setModal(null); setMessage(`Registration confirmed for ${selectedEvent.title}.`);
  }

  async function cancel(event: Event) {
    const response = await fetch(`/api/registrations?eventId=${event.id}`, { method: "DELETE" });
    if (!response.ok) { setMessage(await responseError(response)); return; }
    setRegisteredIds((ids) => ids.filter((id) => id !== event.id));
    setEvents((items) => items.map((item) => item.id === event.id ? { ...item, registered: Math.max(0, item.registered - 1) } : item));
    setMessage(`Your registration for ${event.title} was cancelled.`);
  }

  async function signIn(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!email) { setFormError("Please enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError("Please enter a valid email address."); return; }
    setFormError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    if (!response.ok) { setFormError(await responseError(response)); return; }
    const data = await response.json();
    setUser(data.user); setModal(null); setMessage(`Signed in as ${data.user.role}.`);
    if (data.user.role === "organizer") setView("organizer");
    await loadData();
  }

  async function signUp(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError("Please enter a valid email address."); return; }
    if (!email.endsWith("@pu.edu.pk")) { setFormError("Signup requires an email ending in @pu.edu.pk."); return; }
    setFormError("");
    const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password"), phone: form.get("phone"), department: form.get("department"), semester: form.get("semester") }) });
    if (!response.ok) { setFormError(await responseError(response)); return; }
    const data = await response.json();
    setUser(data.user); setModal(null); setMessage("Account created and signed in.");
    await loadData();
  }

  async function showParticipants(event: Event) {
    const response = await fetch(`/api/events/${event.id}/participants`);
    if (!response.ok) { setMessage(await responseError(response)); return; }
    const data = await response.json();
    setParticipants(data.participants ?? []); setParticipantsEvent(event); setModal("participants");
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null); setRegisteredIds([]); setView("student"); setMessage("You have been signed out.");
  }

  async function changePassword(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const response = await fetch("/api/auth/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) });
    if (!response.ok) { setMessage(await responseError(response)); return; }
    setModal(null); setMessage("Your password has been changed.");
  }

  async function createEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    let bannerImage = null;
    try { bannerImage = await readImageFile(form.get("bannerImage")); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read poster image."); return; }
    const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), category: form.get("category"), date: `${form.get("date")}T${form.get("time")}`, location: form.get("location"), capacity: Number(form.get("seats")), description: form.get("description"), requiresPayment: form.get("requiresPayment") === "on", paymentAmount: Number(form.get("paymentAmount")), bannerImage }) });
    if (!response.ok) { setMessage(await responseError(response)); return; }
    const data = await response.json();
    setEvents((items) => [...items, data.event]); setModal(null); setMessage("Event created and added to the event list.");
  }

  async function saveEvent(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!editingEvent) return;
    const form = new FormData(formEvent.currentTarget);
    let bannerImage = null;
    try { bannerImage = await readImageFile(form.get("bannerImage")); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read poster image."); return; }
    const response = await fetch(`/api/events/${editingEvent.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), category: form.get("category"), date: `${form.get("date")}T${form.get("time")}`, location: form.get("location"), capacity: Number(form.get("seats")), description: form.get("description"), requiresPayment: form.get("requiresPayment") === "on", paymentAmount: Number(form.get("paymentAmount")), bannerImage }) });
    if (!response.ok) { setMessage(await responseError(response)); return; }
    const data = await response.json();
    setEvents((items) => items.map((item) => item.id === editingEvent.id ? { ...data.event, registered: item.registered } : item));
    setEditingEvent(null); setModal(null); setMessage("Event updated successfully.");
  }

  async function deleteEvent(event: Event) {
    if (!window.confirm(`Delete “${event.title}” and its registrations?`)) return;
    const response = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    if (!response.ok) { setMessage(await responseError(response)); return; }
    setEvents((items) => items.filter((item) => item.id !== event.id)); setMessage("Event deleted.");
  }

  return <main>
    <header className={styles.header}><div className={styles.headerInner}>
      <button className={styles.logo} onClick={() => { setView("student"); setMessage(""); }}><span>Campus</span>Connect</button>
      <nav className={styles.nav}><button className={view === "student" ? styles.activeNav : ""} onClick={() => setView("student")}>Browse events</button>{user?.role === "organizer" && <button className={view === "organizer" ? styles.activeNav : ""} onClick={() => setView("organizer")}>Organizer dashboard</button>}</nav>
      <div className={styles.profile}><button className={styles.profile} onClick={() => setModal(user ? "settings" : "login")}><span className={styles.avatar}>{user ? user.name.split(" ").map((part) => part[0]).join("") : "?"}</span><span>{user?.name ?? "Sign in"}</span></button>{user && <button className={styles.signOut} onClick={signOut}>Sign out</button>}</div>
    </div></header>
    {view === "student" ? <><section className={styles.hero} id="top"><div><p className={styles.eyebrow}>UNIVERSITY EVENTS</p><h1>Make your campus<br /><em>experience count.</em></h1><p className={styles.heroText}>Discover what is happening on campus, save your seat, and never miss a moment.</p></div><div className={styles.heroShape}><span>✦</span></div></section><section className={styles.content}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>WHAT&apos;S HAPPENING</p><h2>Find your next event</h2></div><span className={styles.eventCount}>{filteredEvents.length} events</span></div><div className={styles.controls}><div className={styles.search}><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." /></div><div className={styles.filters}>{categories.map((category) => <button key={category} className={activeCategory === category ? styles.selectedFilter : ""} onClick={() => setActiveCategory(category)}>{category}</button>)}</div></div>{message && <div className={styles.message}>{message}</div>}{loading ? <p className={styles.loading}>Loading events…</p> : <div className={styles.eventGrid}>{filteredEvents.map((event, index) => { const available = event.seats - event.registered; const isRegistered = registeredIds.includes(event.id); return <article className={styles.card} key={event.id}><div className={`${styles.cardArt} ${styles[colors[index % colors.length]]}`}><span>{event.category}</span><strong>{event.title.split(" ").map((word) => word[0]).join("")}</strong></div><div className={styles.cardBody}><p className={styles.cardDate}>{eventDate(event.date)}</p><h3>{event.title}</h3><p className={styles.description}>{event.description}</p><p className={styles.location}>⌖ {event.location}</p><div className={styles.cardFooter}><span className={available ? styles.seats : styles.full}>{available ? `${available} seats left` : "Fully booked"}</span>{isRegistered ? <button className={styles.cancelButton} onClick={() => cancel(event)}>Cancel</button> : <button className={styles.registerButton} disabled={!available} onClick={() => startRegistration(event)}>Register <span>→</span></button>}</div></div></article>; })}</div>}</section></> : <Organizer events={events} onCreate={() => setModal("create")} onParticipants={showParticipants} onEdit={(event) => { setEditingEvent(event); setModal("edit"); }} onDelete={deleteEvent} />}
    <footer className={styles.footer}><span>CampusConnect</span><span>Built for student life · 2026</span></footer>
    {modal === "login" && <div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={signIn}><button type="button" className={styles.close} onClick={() => setModal(null)}>×</button><p className={styles.eyebrow}>ACCOUNT ACCESS</p><h2>Sign in to continue</h2><p className={styles.modalIntro}>Students use their PU email. Organizer access appears automatically after organizer sign-in.</p>{formError && <p className="formError" role="alert">{formError}</p>}<label>Email<input name="email" type="email" placeholder="you@pu.edu.pk" required /></label><label>Password<input name="password" type="password" placeholder="Your password" required /></label><button className={styles.primaryAction}>Sign in</button><button type="button" className={styles.textAction} onClick={() => { setFormError(""); setModal("signup"); }}>Create a CampusConnect account</button></form></div>}
    {modal === "signup" && <div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={signUp}><button type="button" className={styles.close} onClick={() => setModal(null)}>×</button><p className={styles.eyebrow}>CAMPUSCONNECT ACCOUNT</p><h2>Create your account</h2><p className={styles.modalIntro}>Use your PU email address to create a CampusConnect student account.</p>{formError && <p className="formError" role="alert">{formError}</p>}<div className={styles.formGrid}><label>Full name<input name="name" required /></label><label>PU email<input name="email" type="email" placeholder="you@pu.edu.pk" required /></label><label>Password<input name="password" type="password" minLength={8} required /></label><label>Phone number<input name="phone" required /></label><label>Department<input name="department" required /></label><label>Semester<input name="semester" placeholder="e.g. 5th" required /></label></div><button className={styles.primaryAction}>Create CampusConnect account</button><button type="button" className={styles.textAction} onClick={() => { setFormError(""); setModal("login"); }}>Already have an account? Sign in</button></form></div>}
    {modal === "register" && selectedEvent && <div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={register}><button type="button" className={styles.close} onClick={() => { setModal(null); setSelectedEvent(null); }}>×</button><p className={styles.eyebrow}>EVENT REGISTRATION</p><h2>{selectedEvent.title}</h2><p className={styles.modalIntro}>Your account details are ready. Add payment proof only if this event requires it.</p><div className={styles.formGrid}><label>Full name<input name="fullName" defaultValue={user?.name ?? ""} required /></label><label>Phone<input name="phone" defaultValue={user?.phone ?? ""} required /></label><label>Department<input name="department" defaultValue={user?.department ?? ""} required /></label><label>Semester<input name="semester" defaultValue={user?.semester ?? ""} required /></label></div>{selectedEvent.requiresPayment && <label>Payment proof image<input name="paymentProof" type="file" accept="image/*" required /><small>PNG/JPG, maximum 2 MB.</small></label>}<label>Notes<textarea name="notes" placeholder="Anything the organizer should know?" /></label><button className={styles.primaryAction}>Confirm registration</button></form></div>}
    {modal === "participants" && participantsEvent && <div className={styles.modalBackdrop}><div className={`${styles.modal} participantModal`}><button type="button" className={styles.close} onClick={() => setModal(null)}>×</button><p className={styles.eyebrow}>REGISTERED PARTICIPANTS</p><h2>{participantsEvent.title}</h2>{participants.length === 0 ? <p className={styles.modalIntro}>No active registrations yet.</p> : <div className="tableScroll"><table className="participantTable"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Department</th><th>Semester</th><th>Proof</th></tr></thead><tbody>{participants.map((participant) => <tr key={participant.id}><td>{participant.fullName}</td><td>{participant.email}</td><td>{participant.phone || "—"}</td><td>{participant.department || "—"}</td><td>{participant.semester || "—"}</td><td>{participant.paymentProof ? <a href={participant.paymentProof} target="_blank" rel="noreferrer"><img className="proofThumb" src={participant.paymentProof} alt="Payment proof" /></a> : "—"}</td></tr>)}</tbody></table></div>}</div></div>}
    {modal === "settings" && user && <div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={changePassword}><button type="button" className={styles.close} onClick={() => setModal(null)}>×</button><p className={styles.eyebrow}>ACCOUNT SETTINGS</p><h2>Change password</h2><p className={styles.modalIntro}>Signed in as {user.email}. Choose a new password for your account.</p><label>Current password<input name="currentPassword" type="password" required /></label><label>New password<input name="newPassword" type="password" minLength={8} required /></label><button className={styles.primaryAction}>Save new password</button></form></div>}
    {modal === "create" && <div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={createEvent}><button type="button" className={styles.close} onClick={() => setModal(null)}>×</button><p className={styles.eyebrow}>ORGANIZER AREA</p><h2>Create an event</h2><div className={styles.formGrid}><label>Event title<input name="title" placeholder="e.g. Design Meetup" required /></label><label>Category<select name="category" defaultValue="Academic"><option>Academic</option><option>Sports</option><option>Culture</option><option>Workshop</option></select></label><label>Date<input name="date" type="date" required /></label><label>Time<input name="time" type="time" required /></label><label>Location<input name="location" placeholder="Room or venue" required /></label><label>Seats<input name="seats" type="number" min="1" placeholder="50" required /></label></div><label>Description<textarea name="description" placeholder="What should students know?" required /></label><label className="checkboxLabel"><input name="requiresPayment" type="checkbox" /> Payment proof required</label><label>Payment amount<input name="paymentAmount" type="number" min="0.01" step="0.01" placeholder="e.g. 500" /></label><button className={styles.primaryAction}>Create event</button></form></div>}
    {modal === "edit" && editingEvent && <div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={saveEvent}><button type="button" className={styles.close} onClick={() => setModal(null)}>×</button><p className={styles.eyebrow}>ORGANIZER AREA</p><h2>Edit event</h2><div className={styles.formGrid}><label>Event title<input name="title" defaultValue={editingEvent.title} required /></label><label>Category<select name="category" defaultValue={editingEvent.category}><option>Academic</option><option>Sports</option><option>Culture</option><option>Workshop</option></select></label><label>Date<input name="date" type="date" defaultValue={editingEvent.date.slice(0, 10)} required /></label><label>Time<input name="time" type="time" defaultValue={new Date(editingEvent.date).toISOString().slice(11, 16)} required /></label><label>Location<input name="location" defaultValue={editingEvent.location} required /></label><label>Seats<input name="seats" type="number" min="1" defaultValue={editingEvent.seats} required /></label></div><label>Description<textarea name="description" defaultValue={editingEvent.description} required /></label><label className="checkboxLabel"><input name="requiresPayment" type="checkbox" defaultChecked={editingEvent.requiresPayment} /> Payment proof required</label><label>Payment amount<input name="paymentAmount" type="number" min="0.01" step="0.01" defaultValue={editingEvent.paymentAmount ?? ""} /></label><button className={styles.primaryAction}>Save changes</button></form></div>}
  </main>;
}

function Organizer({ events, onCreate, onParticipants, onEdit, onDelete }: { events: Event[]; onCreate: () => void; onParticipants: (event: Event) => void; onEdit: (event: Event) => void; onDelete: (event: Event) => void }) {
  const totalSeats = events.reduce((sum, event) => sum + event.seats, 0);
  const totalRegistrations = events.reduce((sum, event) => sum + event.registered, 0);
  return <section className={styles.dashboard}><p className={styles.eyebrow}>ORGANIZER AREA</p><h1>Event dashboard</h1><p className={styles.dashboardIntro}>Manage your events and keep track of student registrations.</p><div className={styles.stats}><div><span>Published events</span><strong>{events.length}</strong></div><div><span>Total registrations</span><strong>{totalRegistrations}</strong></div><div><span>Available seats</span><strong>{totalSeats - totalRegistrations}</strong></div></div><div className={styles.dashboardPanel}><div className={styles.panelHeader}><h2>Your events</h2><button className={styles.registerButton} onClick={onCreate}>+ Create event</button></div>{events.map((event) => <div className={styles.eventRow} key={event.id}><div className={`${styles.smallArt} ${styles.blue}`}>{event.title[0]}</div><div className={styles.rowTitle}><strong>{event.title}</strong><span>{eventDate(event.date)} · {event.location}</span></div><div className={styles.progressWrap}><span>{event.registered} / {event.seats} registered</span><div className={styles.progress}><i style={{ width: `${Math.min(100, Math.round((event.registered / event.seats) * 100))}%` }} /></div></div><div className="eventActions"><button className="moreButton" onClick={() => onParticipants(event)}>Registrations</button><button className="moreButton" onClick={() => onEdit(event)}>Edit</button><button className="deleteButton" onClick={() => onDelete(event)}>Delete</button></div></div>)}</div></section>;
}
