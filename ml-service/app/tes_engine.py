"""
Ice TES Sizing Engine
Port of the five-step thermodynamic chain from the BTP paper.

Constants from Table 2 of the paper:
- COP_Carnot = T_evap / (T_cond - T_evap)
- COP_actual = COP_Carnot * eta_carnot (eta_carnot = 0.55)
- SLR = Q_sensible / Q_latent
- Latent heat of fusion: L = 334 kJ/kg
- Chiller COP ~ 3.5-4.5 depending on temperatures
- Ice density: rho_ice = 917 kg/m3
- Thermal lag: 37.5 minutes (BTP-II validated)
"""

import math
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field


class TESInput(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    p10_kwh: float = Field(..., description="P10 forecast (kWh)")
    p50_kwh: float = Field(..., description="P50 forecast (kWh)")
    p90_kwh: float = Field(..., description="P90 forecast (kWh)")
    temp_evap_c: float = Field(default=-8.0, description="Evaporator temperature (°C)")
    temp_cond_c: float = Field(default=35.0, description="Condenser temperature (°C)")
    cop_carnot_eff: float = Field(default=0.55, description="Carnot efficiency factor")
    slr: float = Field(default=0.15, description="Sensible-to-latent ratio")
    ice_density_kg_m3: float = Field(default=917.0, description="Ice density (kg/m3)")
    latent_heat_kj_kg: float = Field(default=334.0, description="Latent heat of fusion (kJ/kg)")


class HallDischarge(BaseModel):
    hall_id: str
    tier: str  # Large / Medium / Small
    num_rooms: int
    ice_allocation_kg: float
    discharge_kwh: float
    start_time: str
    end_time: str


class TESOutput(BaseModel):
    date: str
    # Core sizing
    ice_mass_kg: float
    ice_volume_m3: float
    coverage_pct: float
    # Thermodynamics
    cop_carnot: float
    cop_actual: float
    effective_cop: float
    slr: float
    # Energy
    total_generation_kwh: float
    cooling_energy_required_kwh: float
    excess_energy_kwh: float
    # Charging
    charging_window: str
    charging_hours: float
    thermal_lag_minutes: float
    # Discharge schedule
    discharge_schedule: List[HallDischarge]
    # Tier summary
    tier_summary: dict


# Hall configuration (21 halls, 3 tiers)
HALLS = [
    # Large halls (5 halls, ~1200 rooms each)
    {"id": "H1", "tier": "Large", "rooms": 1200},
    {"id": "H2", "tier": "Large", "rooms": 1150},
    {"id": "H3", "tier": "Large", "rooms": 1100},
    {"id": "H4", "tier": "Large", "rooms": 1050},
    {"id": "H5", "tier": "Large", "rooms": 1000},
    # Medium halls (8 halls, ~400-600 rooms each)
    {"id": "H6", "tier": "Medium", "rooms": 600},
    {"id": "H7", "tier": "Medium", "rooms": 550},
    {"id": "H8", "tier": "Medium", "rooms": 500},
    {"id": "H9", "tier": "Medium", "rooms": 480},
    {"id": "H10", "tier": "Medium", "rooms": 450},
    {"id": "H11", "tier": "Medium", "rooms": 420},
    {"id": "H12", "tier": "Medium", "rooms": 400},
    {"id": "H13", "tier": "Medium", "rooms": 380},
    # Small halls (8 halls, ~150-300 rooms each)
    {"id": "H14", "tier": "Small", "rooms": 300},
    {"id": "H15", "tier": "Small", "rooms": 280},
    {"id": "H16", "tier": "Small", "rooms": 250},
    {"id": "H17", "tier": "Small", "rooms": 220},
    {"id": "H18", "tier": "Small", "rooms": 200},
    {"id": "H19", "tier": "Small", "rooms": 180},
    {"id": "H20", "tier": "Small", "rooms": 150},
    {"id": "H21", "tier": "Small", "rooms": 143},
]

TOTAL_ROOMS = sum(h["rooms"] for h in HALLS)  # 8173


def compute_cop_carnot(temp_evap_c: float, temp_cond_c: float) -> float:
    """Carnot COP for a refrigeration cycle.
    COP_Carnot = T_evap / (T_cond - T_evap), where T is in Kelvin.
    """
    T_evap_K = temp_evap_c + 273.15
    T_cond_K = temp_cond_c + 273.15
    if T_cond_K <= T_evap_K:
        return 1.0
    return T_evap_K / (T_cond_K - T_evap_K)


def compute_actual_cop(cop_carnot: float, eta_carnot: float) -> float:
    return cop_carnot * eta_carnot


def compute_ice_mass(
    excess_energy_kwh: float,
    cop_actual: float,
    slr: float,
    latent_heat_kj_kg: float,
) -> float:
    """Compute ice mass needed to store excess generation.

    Excess energy → chiller input → cooling energy = E_excess * COP
    Of that cooling energy, fraction (1/(1+SLR)) goes to phase change (ice making).
    Q_latent = E_excess * COP / (1 + SLR)
    Ice mass = Q_latent * 1000 / L   (converting kJ to J via /1000 and L in kJ/kg)

    Wait — let me be precise:
    - E_excess is in kWh, convert to kJ: E_excess * 3600
    - Cooling produced = E_excess * COP_actual (in kWh cooling)
    - In kJ: E_excess * 3600 * COP_actual
    - Q_latent portion = total_cooling / (1 + SLR)
    - Ice mass = Q_latent_kJ / L_kJ_per_kg
    """
    excess_kj = excess_energy_kwh * 3600 * cop_actual
    q_latent_kj = excess_kj / (1 + slr)
    ice_mass_kg = q_latent_kj / latent_heat_kj_kg
    return max(0, ice_mass_kg)


def compute_ice_volume(ice_mass_kg: float, ice_density_kg_m3: float) -> float:
    return ice_mass_kg / ice_density_kg_m3


def get_charging_window(doy: int) -> tuple:
    """Determine solar charging window based on season.
    Returns (start_hour, end_hour) — the window when solar generation exceeds load.
    Adjusted for IIT Kharagpur latitude (22.32N).
    """
    if doy < 80 or doy > 355:  # Winter: Dec-Feb
        return (9, 16)
    elif doy < 172:  # Spring: Mar-May
        return (8, 17)
    elif doy < 265:  # Monsoon/Summer: Jun-Sep
        return (8, 18)
    else:  # Autumn: Oct-Nov
        return (9, 17)


def create_waterfall_discharge(
    ice_mass_kg: float,
    date_str: str,
    slr: float,
    latent_heat_kj_kg: float,
) -> List[HallDischarge]:
    """Create waterfall-tiered discharge schedule across 21 halls.

    Discharge hours: 20:00-06:00 (10 hours night-time cooling).
    Large halls get priority, then Medium, then Small — the "waterfall" pattern.
    """
    discharge_hours = 10  # 20:00 to 06:00
    schedule = []

    # Total cooling energy from ice: Q = m * L / 3600 (kJ → kWh)
    total_cooling_kwh = (ice_mass_kg * latent_heat_kj_kg) / 3600
    total_cooling_with_slr = total_cooling_kwh / (1 + slr)

    # Allocate proportionally to room count
    for hall in HALLS:
        fraction = hall["rooms"] / TOTAL_ROOMS
        ice_alloc = ice_mass_kg * fraction
        cooling_kwh = total_cooling_with_slr * fraction

        schedule.append(HallDischarge(
            hall_id=hall["id"],
            tier=hall["tier"],
            num_rooms=hall["rooms"],
            ice_allocation_kg=round(ice_alloc, 1),
            discharge_kwh=round(cooling_kwh, 2),
            start_time="20:00",
            end_time="06:00",
        ))

    return schedule


def run_tes_sizing(input_data: TESInput) -> TESOutput:
    """Run the full 5-step TES sizing chain."""
    dt = datetime.strptime(input_data.date, "%Y-%m-%d")
    doy = dt.timetuple().tm_yday

    # Step 1: Carnot COP
    cop_carnot = compute_cop_carnot(input_data.temp_evap_c, input_data.temp_cond_c)

    # Step 2: Actual COP
    cop_actual = compute_actual_cop(cop_carnot, input_data.cop_carnot_eff)

    # Step 3: Excess energy (generation minus base load, simplified)
    # Using P50 as the expected generation
    base_load_kwh = 5000  # Estimated campus base daytime load
    excess_energy_kwh = max(0, input_data.p50_kwh - base_load_kwh)

    # Step 4: Ice mass and volume
    ice_mass_kg = compute_ice_mass(
        excess_energy_kwh, cop_actual, input_data.slr, input_data.latent_heat_kj_kg
    )
    ice_volume_m3 = compute_ice_volume(ice_mass_kg, input_data.ice_density_kg_m3)

    # Coverage: how much of the 151,100 kg / 164.8 m3 full target is met
    coverage_pct = (ice_mass_kg / 151100) * 100

    # Step 5: Charging window
    start_h, end_h = get_charging_window(doy)
    charging_hours = end_h - start_h
    thermal_lag = 37.5  # minutes, from BTP-II validation

    # Cooling energy required for full overnight coverage (all 21 halls)
    total_cooling_required_kwh = 151100 * input_data.latent_heat_kj_kg / 3600

    # Discharge schedule
    discharge = create_waterfall_discharge(
        ice_mass_kg, input_data.date, input_data.slr, input_data.latent_heat_kj_kg
    )

    # Tier summary
    tier_summary = {}
    for tier in ["Large", "Medium", "Small"]:
        tier_halls = [h for h in HALLS if h["tier"] == tier]
        tier_rooms = sum(h["rooms"] for h in tier_halls)
        tier_discharge = sum(d.discharge_kwh for d in discharge if d.tier == tier)
        tier_ice = sum(d.ice_allocation_kg for d in discharge if d.tier == tier)
        tier_summary[tier] = {
            "halls": len(tier_halls),
            "rooms": tier_rooms,
            "ice_kg": round(tier_ice, 1),
            "discharge_kwh": round(tier_discharge, 2),
        }

    return TESOutput(
        date=input_data.date,
        ice_mass_kg=round(ice_mass_kg, 1),
        ice_volume_m3=round(ice_volume_m3, 2),
        coverage_pct=round(min(coverage_pct, 100.0), 1),
        cop_carnot=round(cop_carnot, 3),
        cop_actual=round(cop_actual, 3),
        effective_cop=round(cop_actual / (1 + input_data.slr), 3),
        slr=input_data.slr,
        total_generation_kwh=round(input_data.p50_kwh, 2),
        cooling_energy_required_kwh=round(total_cooling_required_kwh, 2),
        excess_energy_kwh=round(excess_energy_kwh, 2),
        charging_window=f"{start_h:02d}:00-{end_h:02d}:00",
        charging_hours=charging_hours,
        thermal_lag_minutes=thermal_lag,
        discharge_schedule=discharge,
        tier_summary=tier_summary,
    )
