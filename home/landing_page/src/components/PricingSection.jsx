import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CoffeeIcon } from './CoffeeIcon';
import { API_BASE } from '../../../../src/app/lib/apiBase';
import { parseServiceDetailRows } from '../../../../src/app/lib/serviceDetailsFormat';
import './PricingSection.css';

/** Render description_points the same way the user portal service selection does */
function ServicePoints({ points }) {
  if (!points || points.length === 0) return null;
  const rows = parseServiceDetailRows(points);
  if (rows.length === 0) return null;
  return (
    <ul className="pricing-points">
      {rows.map((row, i) => {
        if (row.kind === 'heading') {
          return <li key={i} className="pricing-point-heading">{row.text}</li>;
        }
        if (row.kind === 'excluded') {
          return <li key={i} className="pricing-point-excluded">{row.text}</li>;
        }
        return <li key={i} className="pricing-point-included">{row.text}</li>;
      })}
    </ul>
  );
}

const SLIDE_INTERVAL = 3500;

const PricingSection = () => {
  const [vehicleBlocks, setVehicleBlocks] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const branchRes = await fetch(`${API_BASE}/public/branches`);
        if (!branchRes.ok) throw new Error('Failed to load branches');
        const branches = await branchRes.json();
        if (!branches.length) return;

        const branchId = branches[0].id;
        const blocksRes = await fetch(`${API_BASE}/public/branches/${branchId}/vehicle-blocks`);
        if (!blocksRes.ok) throw new Error('Failed to load services');
        const blocks = await blocksRes.json();

        setVehicleBlocks(blocks);
        if (blocks.length) setSelectedVehicle(blocks[0].vehicle_type);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const currentBlock = vehicleBlocks.find((b) => b.vehicle_type === selectedVehicle);
  const activeServices = currentBlock
    ? currentBlock.services
        .filter((s) => s.active && s.catalog_group_id)
        .sort((a, b) => a.sequence - b.sequence)
    : [];

  const categories = ['All', ...Array.from(new Set(activeServices.map((s) => s.category).filter(Boolean)))];

  const filteredServices =
    selectedCategory === 'All'
      ? activeServices
      : activeServices.filter((s) => s.category === selectedCategory);

  const total = filteredServices.length;

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + total) % total);
  }, [total]);

  // Reset slide index when services change
  useEffect(() => {
    setCurrent(0);
  }, [selectedVehicle, selectedCategory]);

  // Auto-slide
  useEffect(() => {
    if (paused || total <= 1) return;
    timerRef.current = setInterval(next, SLIDE_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [paused, total, next]);

  const handleVehicleChange = (vtype) => {
    setSelectedVehicle(vtype);
    setSelectedCategory('All');
  };

  return (
    <section className="pricing-section sec" id="pricing">
      <h2>Service Pricing</h2>

      {loading && (
        <div className="pricing-loading">
          <div className="pricing-spinner" />
          <span>Loading services…</span>
        </div>
      )}

      {error && (
        <div className="pricing-error">
          Unable to load live pricing.{' '}
          <a href="#/home">Book online</a> to see all services.
        </div>
      )}

      {!loading && !error && vehicleBlocks.length > 0 && (
        <>
          {/* Vehicle type pills */}
          <div className="pricing-vehicles" role="group" aria-label="Select vehicle type">
            {vehicleBlocks.map((b) => (
              <button
                key={b.vehicle_type}
                className={`pricing-vpill${selectedVehicle === b.vehicle_type ? ' active' : ''}`}
                onClick={() => handleVehicleChange(b.vehicle_type)}
                aria-pressed={selectedVehicle === b.vehicle_type}
              >
                {b.vehicle_type}
              </button>
            ))}
          </div>

          {/* Category tabs */}
          {categories.length > 2 && (
            <div className="pricing-cats" role="tablist" aria-label="Service category">
              {categories.map((cat) => (
                <button
                  key={cat}
                  role="tab"
                  aria-selected={selectedCategory === cat}
                  className={`pricing-cattab${selectedCategory === cat ? ' active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Slider */}
          {total > 0 ? (
            <div
              className="pricing-slider-wrap"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div className="pricing-track">
                {filteredServices.map((svc, idx) => {
                  const offset = idx - current;
                  const pos =
                    offset === 0 ? 'center'
                    : offset === 1 || offset === -(total - 1) ? 'right'
                    : offset === -1 || offset === total - 1 ? 'left'
                    : 'hidden';

                  return (
                    <div
                      key={svc.id}
                      className={`pricing-card pc-${pos}`}
                      aria-hidden={pos !== 'center'}
                      style={pos !== 'center' ? { position: 'absolute' } : { position: 'relative' }}
                    >
                      <div className="pricing-card-top">
                        <h3 className="pricing-name">{svc.name}</h3>
                        <div className="pricing-price-block">
                          <span className="pricing-price">${svc.price.toFixed(0)}</span>
                          {svc.duration_minutes > 0 && (
                            <span className="pricing-duration">{svc.duration_minutes} min</span>
                          )}
                        </div>
                      </div>

                      <ServicePoints points={svc.description_points} />

                      {svc.free_coffee_count > 0 && (
                        <div className="pricing-coffee">
                          <CoffeeIcon size={14} />
                          <span>
                            {svc.free_coffee_count === 1
                              ? 'Complimentary coffee included'
                              : `${svc.free_coffee_count} complimentary coffees`}
                          </span>
                        </div>
                      )}

                      <a href="#/home" className="pricing-book-btn" aria-label={`Book ${svc.name}`}>
                        Book Now
                      </a>
                    </div>
                  );
                })}
              </div>

              {/* Arrows rendered after track so they paint on top */}
              {total > 1 && (
                <button className="pricing-arrow pricing-arrow--prev" onClick={prev} aria-label="Previous service">
                  ‹
                </button>
              )}
              {total > 1 && (
                <button className="pricing-arrow pricing-arrow--next" onClick={next} aria-label="Next service">
                  ›
                </button>
              )}

              {/* Dot indicators */}
              {total > 1 && (
                <div className="pricing-dots" role="tablist" aria-label="Service slides">
                  {filteredServices.map((_, i) => (
                    <button
                      key={i}
                      role="tab"
                      aria-selected={i === current}
                      className={`pricing-dot${i === current ? ' active' : ''}`}
                      onClick={() => setCurrent(i)}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="pricing-empty">No services available for this selection.</p>
          )}

        </>
      )}
    </section>
  );
};

export default PricingSection;
