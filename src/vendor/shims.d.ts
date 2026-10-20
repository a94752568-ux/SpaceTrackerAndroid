/* Tipado de los módulos venderizados reutilizando los @types oficiales
   (devDependencies): el bundle runtime no necesita los paquetes originales. */
declare module "*vendor/d3-geo/index.js" {
  export * from "d3-geo";
}
declare module "*vendor/topojson-client/index.js" {
  export * from "topojson-client";
}
