import React from 'react';
import Icon from './Icons';
import ScrollReveal from './ScrollReveal';

const STORIES = [
  {
    quote: "Finding a true dark-sky pitch with zero light pollution changed how my family experiences the outdoors. The coordinates and water notices were spot on.",
    author: "Elena Rostova",
    role: "Alpine Solo Hiker",
    campsite: "Ember Flats Dark-Sky",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    badge: "Verified Camper",
  },
  {
    quote: "No inflated hotel prices or booked-out state parks. YelpCamp gave us an untouched clearing right beside the river in Olympic Peninsula.",
    author: "Marcus Thorne",
    role: "Trail Runner & Vanlifer",
    campsite: "Fern Hollow Sanctuary",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    badge: "34 Nights Logged",
  },
  {
    quote: "The live ranger and fire burn ban alerts saved our trip when strong winds hit the valley. Having real terrain intelligence is indispensable.",
    author: "Dr. Sarah Chen",
    role: "Wilderness First Responder",
    campsite: "Ridgeline Cloud Camp",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80",
    badge: "Field Guide",
  },
];

export default function CamperStories() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 md:py-32">
      <ScrollReveal variant="fade-up" delay={50}>
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
          <span className="inline-flex items-center gap-2 px-3 py-1 mb-2.5 sm:mb-3 rounded-full border border-sky-400/20 bg-surface/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] sm:tracking-[0.25em] text-secondary">
            Voices From The Trail
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-black leading-[1.05] tracking-tight text-fg md:text-5xl">
            Tested by the <span className="aurora-text">backcountry community.</span>
          </h2>
          <p className="mt-3 sm:mt-4 text-xs sm:text-sm md:text-base text-fg-muted">
            Unfiltered stories, verified site conditions, and memorable nights under the northern lights.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {STORIES.map((story, i) => (
          <ScrollReveal
            key={story.author}
            variant="fade-up"
            delay={i * 120}
            className="glass-titanium p-6 sm:p-8 rounded-2xl sm:rounded-3xl relative group flex flex-col justify-between hover:border-secondary/40 transition-all duration-300"
          >
            <div>
              {/* Stars & Badge */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: story.rating }).map((_, idx) => (
                    <Icon.Star key={idx} size={15} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-sky-400/20 bg-background/60 text-secondary">
                  {story.badge}
                </span>
              </div>

              {/* Quote */}
              <blockquote className="text-sm md:text-[15px] text-fg-muted leading-relaxed mb-6 font-normal">
                "{story.quote}"
              </blockquote>
            </div>

            {/* Author details */}
            <div className="pt-5 border-t border-border/60 flex items-center gap-3.5">
              <img
                src={story.avatar}
                alt={story.author}
                className="w-11 h-11 rounded-full object-cover border border-border-strong group-hover:border-secondary transition-colors"
              />
              <div className="min-w-0">
                <div className="font-display font-bold text-sm text-fg truncate">
                  {story.author}
                </div>
                <div className="text-[11px] text-fg-subtle truncate">
                  {story.role} • <span className="text-secondary">{story.campsite}</span>
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
