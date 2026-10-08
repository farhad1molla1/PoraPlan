import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MessageSquare, ExternalLink, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export const ContactPage: React.FC = () => {
  return (
    <div className="w-full pb-16 sm:pb-20">
      {/* Top Banner / Breadcrumb */}
      <section className="bg-brand-paper border-b-2 border-brand-dark py-8 sm:py-12 academic-grid-pattern">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1 font-mono text-xs uppercase font-bold text-brand-dark hover:text-brand-teal"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              Back to Home
            </Link>
            <span className="text-brand-muted font-mono text-xs">/</span>
            <Badge variant="navy" size="sm">CONTACT</Badge>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-brand-navy tracking-tight">
            Contact PoraPlan
          </h1>
          <p className="mt-2 text-base sm:text-lg text-brand-dark/85 font-sans max-w-2xl leading-relaxed">
            Personal study assistance and mentorship support. Reach out with questions about onboarding, mentor pairings, or your study plan.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-8 sm:space-y-12">
        
        {/* Contact Channels Grid */}
        <section aria-labelledby="contact-channels" className="space-y-4">
          <div className="border-b-2 border-brand-dark pb-2">
            <span className="font-mono text-xs uppercase font-bold text-brand-muted">
              // REACH OUR TEAM DIRECTLY
            </span>
            <h2 id="contact-channels" className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy">
              Official Contact Channels
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-2">
            
            {/* Email Card */}
            <div className="p-5 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 border-2 border-brand-dark bg-brand-teal-light flex items-center justify-center shadow-brutal-xs">
                  <Mail className="w-5 h-5 text-brand-dark stroke-[2.2]" />
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal block">
                    EMAIL
                  </span>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-brand-navy mt-0.5">
                    Email Support
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-dark/80 font-sans mt-1">
                    Send us your general inquiries or mentor verification requests.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-brand-dark/20 mt-4">
                <a
                  href="mailto:poraplan.bd@gmail.com"
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-brand-teal hover:underline break-all"
                >
                  <span>poraplan.bd@gmail.com</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                </a>
              </div>
            </div>

            {/* Facebook Card */}
            <div className="p-5 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-center shadow-brutal-xs">
                  <ExternalLink className="w-5 h-5 text-brand-dark stroke-[2.2]" />
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-navy block">
                    COMMUNITY
                  </span>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-brand-navy mt-0.5">
                    Official Facebook
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-dark/80 font-sans mt-1">
                    Connect with our student community and get platform updates.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-brand-dark/20 mt-4">
                <a
                  href="https://www.facebook.com/profile.php?id=61593180002346"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-brand-navy hover:text-brand-teal hover:underline"
                >
                  <span>facebook.com/PoraPlan</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                </a>
              </div>
            </div>

            {/* WhatsApp Card */}
            <div className="p-5 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 border-2 border-brand-dark bg-brand-gold-light flex items-center justify-center shadow-brutal-xs">
                  <MessageSquare className="w-5 h-5 text-brand-dark stroke-[2.2]" />
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold-dark block">
                    WHATSAPP
                  </span>
                  <h3 className="font-heading font-bold text-base sm:text-lg text-brand-navy mt-0.5">
                    Direct Assistance
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-dark/80 font-sans mt-1">
                    Fast responses for onboarding questions and student inquiries.
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-brand-dark/20 mt-4">
                <span className="font-mono text-xs font-bold text-brand-dark">
                  @PoraPlan
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* Member Access Information */}
        <section className="border-2 border-brand-dark bg-brand-paper p-6 sm:p-8 shadow-brutal space-y-4">
          <div className="flex items-center gap-2 text-brand-navy font-heading font-bold text-base">
            <ShieldCheck className="w-5 h-5 text-brand-teal stroke-[2.5]" />
            <span>New to PoraPlan?</span>
          </div>

          <p className="text-sm text-brand-dark/85 font-sans leading-relaxed">
            Your mentor will provide your PoraPlan ID. PoraPlan does not operate as an open self-registration website; every student receives dedicated academic mentorship and an assigned PoraPlan ID (such as <span className="font-mono font-bold">PP001</span>) directly from an authorized mentor or administrator.
          </p>

          <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint font-sans text-xs text-brand-dark space-y-1">
            <span className="font-bold text-brand-navy block uppercase font-heading">Already have your PoraPlan ID?</span>
            <p>
              Log in to your workspace with your ID and password, or activate your newly issued account.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Button
              to="/login"
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
            >
              Log in with PoraPlan ID
            </Button>
            <Button
              to="/signup"
              variant="outline"
              size="md"
            >
              Activate Your Account
            </Button>
          </div>
        </section>

      </div>
    </div>
  );
};
