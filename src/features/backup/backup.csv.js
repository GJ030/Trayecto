import { S } from '@/data/store';
import { D, fuelTotal } from '@/features/fuel/fuel.calc';
import { compOf, tripCost, tripDur, tripKey, tripKm, tripSpeed } from '@/features/trips/trips.calc';
import { vehName } from '@/features/vehicles/vehicles.calc';
import { toast } from '@/shared/ui/toast';
import { isoDate } from '@/shared/utils/dates';
import { download } from '@/shared/utils/download';

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  /* evita que Excel interprete texto como fórmula */ return /[",\n;]/.test(s)
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};
const toCSV = (rows) => '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
export function exportCSV(kind) {
  if (kind === 'trips') {
    const rows = [
      [
        'fecha',
        'salida',
        'llegada',
        'origen',
        'destino',
        'vehiculo',
        'etiqueta',
        'odometro_inicial',
        'odometro_final',
        'distancia_km',
        'duracion_min',
        'velocidad_kmh',
        'costo_estimado_mxn',
        'rendimiento_computadora_km_l',
      ],
    ];
    [...S.trips]
      .sort((a, b) => tripKey(a).localeCompare(tripKey(b)))
      .forEach((t) =>
        rows.push([
          t.date,
          t.depart,
          t.arrive,
          t.origin,
          t.destination,
          vehName(t.vehicleId),
          t.tag,
          t.odoStart,
          t.odoEnd,
          tripKm(t).toFixed(1),
          tripDur(t),
          tripSpeed(t).toFixed(1),
          tripCost(t).toFixed(2),
          compOf(t) ? +compOf(t).toFixed(2) : '',
        ]),
      );
    download(`trayecto-viajes-${isoDate(new Date())}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    toast('Viajes exportados a CSV');
  } else {
    const rows = [
      [
        'fecha',
        'vehiculo',
        'gasolinera',
        'odometro',
        'litros',
        'precio_litro',
        'total_mxn',
        'tanque_lleno',
        'km_l',
      ],
    ];
    [...S.fuel]
      .sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer)
      .forEach((f) =>
        rows.push([
          f.date,
          vehName(f.vehicleId),
          f.station,
          f.odometer,
          f.liters,
          f.price,
          fuelTotal(f).toFixed(2),
          f.full ? 'sí' : 'no',
          D.kmpl[f.id] ? D.kmpl[f.id].toFixed(2) : '',
        ]),
      );
    download(`trayecto-cargas-${isoDate(new Date())}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    toast('Cargas exportadas a CSV');
  }
}
