import { cantidadCorta, descripcion } from '../lib/formato.js';

export default function PedidoItems({ items }) {
  return (
    <ul className="lista-items">
      {items.map((i) => (
        <li key={i.id}>
          <span className="cant">{cantidadCorta(i.cantidad, i.presentacion)}</span>
          <span className="crece">{descripcion(i.producto_nombre, i.presentacion)}</span>
        </li>
      ))}
    </ul>
  );
}
