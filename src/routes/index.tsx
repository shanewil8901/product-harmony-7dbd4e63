import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Check,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
  Users,
  Mail,
  Menu,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Lumina — Build Faster, Ship Smarter" },
      {
        name: "description",
        content:
          "Lumina is the all-in-one platform that helps teams launch products, automate workflows, and scale with confidence.",
      },
      { property: "og:title", content: "Lumina — Build Faster, Ship Smarter" },
      {
        property: "og:description",
        content:
          "Lumina is the all-in-one platform that helps teams launch products, automate workflows, and scale with confidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Optimized infrastructure that keeps your workflows running at peak performance around the clock.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description:
      "Bank-grade encryption, SSO, and compliance tools that protect your data and your customers.",
  },
  {
    icon: BarChart3,
    title: "Insightful Analytics",
    description:
      "Real-time dashboards and reports that turn raw data into actionable business intelligence.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Shared workspaces, comments, and approvals that keep everyone aligned from idea to launch.",
  },
];

const testimonials = [
  {
    quote:
      "Lumina cut our launch time in half. The analytics alone are worth the subscription.",
    author: "Sarah Chen",
    role: "VP of Product, Orbita",
  },
  {
    quote:
      "Finally a platform that our engineering and marketing teams both love to use.",
    author: "Marcus Johnson",
    role: "CTO, Brightpath",
  },
  {
    quote:
      "The security features gave our enterprise clients the confidence to sign faster.",
    author: "Elena Rodriguez",
    role: "Head of Sales, Nexify",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for solo founders and small side projects.",
    features: [
      "Up to 3 projects",
      "Basic analytics",
      "Email support",
      "Community access",
    ],
    cta: "Start free trial",
    popular: false,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/month",
    description: "For growing teams that need more power and collaboration.",
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority support",
      "SSO & SAML",
      "Custom integrations",
    ],
    cta: "Start free trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Dedicated infrastructure and support for large organizations.",
    features: [
      "Everything in Pro",
      "Dedicated account manager",
      "SLA & audit logs",
      "On-premise option",
      "Custom contracts",
    ],
    cta: "Contact sales",
    popular: false,
  },
];

function Index() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "sent">(
    "idle"
  );

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormStatus("submitting");
    setTimeout(() => setFormStatus("sent"), 1200);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-2 text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            Lumina
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
            <Button size="sm">Get started</Button>
          </div>

          <button
            className="inline-flex items-center justify-center rounded-md p-2 text-foreground md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-3">
                <Button variant="outline" className="w-full">
                  Log in
                </Button>
                <Button className="w-full">Get started</Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pt-20 pb-28 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              <span className="mr-2 flex h-2 w-2 rounded-full bg-emerald-500" />
              Now in public beta
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Build faster. Ship smarter. Scale with confidence.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Lumina gives your team the tools to plan, launch, and optimize
              products in one unified workspace.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="min-w-[10rem]">
                Start free trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="min-w-[10rem]">
                View demo
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No credit card required. 14-day free trial.
            </p>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="border-t border-border bg-muted/30 px-4 py-24 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything you need to move faster
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                A complete toolkit designed for modern product teams.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="border-border bg-card transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-card-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section
          id="testimonials"
          className="px-4 py-24 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Loved by product teams
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                See why hundreds of companies trust Lumina to power their work.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {testimonials.map((t) => (
                <Card
                  key={t.author}
                  className="border-border bg-card"
                >
                  <CardContent className="flex h-full flex-col p-6">
                    <p className="flex-1 text-base leading-relaxed text-card-foreground">
                      “{t.quote}”
                    </p>
                    <div className="mt-6 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold">
                        {t.author.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {t.author}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.role}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="border-t border-border bg-muted/30 px-4 py-24 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Start free, upgrade when you are ready. Cancel anytime.
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <Card
                  key={plan.name}
                  className={`relative flex flex-col border-border bg-card ${
                    plan.popular ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Most popular
                    </div>
                  )}
                  <CardContent className="flex flex-1 flex-col p-6">
                    <h3 className="text-lg font-semibold text-foreground">
                      {plan.name}
                    </h3>
                    <div className="mt-4 flex items-baseline">
                      <span className="text-4xl font-bold tracking-tight text-foreground">
                        {plan.price}
                      </span>
                      <span className="ml-1 text-sm text-muted-foreground">
                        {plan.period}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.features.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 text-sm text-card-foreground"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={plan.popular ? "default" : "outline"}
                      className="mt-8 w-full"
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Get in touch
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Have questions? We would love to hear from you.
              </p>
            </div>
            <Card className="border-border bg-card">
              <CardContent className="p-6 sm:p-8">
                {formStatus === "sent" ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Mail className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-foreground">
                      Message sent
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      Thanks for reaching out. We will get back to you soon.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-6"
                      onClick={() => setFormStatus("idle")}
                    >
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          name="name"
                          placeholder="Jane Doe"
                          required
                          minLength={2}
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="jane@company.com"
                          required
                          maxLength={255}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        name="subject"
                        placeholder="How can we help?"
                        required
                        maxLength={200}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Tell us a bit more..."
                        required
                        minLength={10}
                        maxLength={1000}
                        rows={5}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={formStatus === "submitting"}
                    >
                      {formStatus === "submitting"
                        ? "Sending..."
                        : "Send message"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <a
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-foreground"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-5 w-5" />
            </div>
            Lumina
          </a>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Lumina Inc. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Pricing
            </a>
            <a
              href="#contact"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
