# Política de Privacidad — SpaceTracker

**Última actualización:** 20 de octubre de 2026

SpaceTracker ("la Aplicación") es un visor y rastreador de satélites en órbita terrestre desarrollado para plataformas móviles y de escritorio. Esta Política de Privacidad describe cómo se maneja su información cuando utiliza SpaceTracker.

## 1. Información que Recopilamos y Almacenamos Localmente
SpaceTracker está diseñada con un enfoque centrado en la privacidad del usuario:
- **Ubicación del Observador:** Si usted utiliza la función de ubicación (geolocalización o búsqueda manual de ciudad) para calcular pases de visibilidad y radar local, estas coordenadas (latitud, longitud y zona horaria) se almacenan **exclusivamente de forma local** en su dispositivo mediante `localStorage`. No se transmiten a servidores propios ni se venden a terceros.
- **Favoritos y Preferencias:** Sus listas de satélites favoritos y ajustes de visualización se guardan localmente en el almacenamiento de su dispositivo.

## 2. Conexiones de Red y Datos de Terceros
Para ofrecer su funcionalidad principal en tiempo real, la Aplicación se comunica exclusivamente con fuentes públicas de datos orbitales y meteorológicos a través de HTTPS seguro:
- **Datos Orbitales (TLEs):** Descarga de elementos dos líneas (TLE) desde catálogos públicos y oficiales (como CelesTrak, Space-Track o SatNOGS).
- **Clima y Elevación:** Consultas opcionales a servicios meteorológicos públicos (como Open-Meteo) para mostrar condiciones locales de observación astronómica.
- **Mapas y Teselas:** Carga de mapas base desde proveedores públicos de mosaicos (Carto / Esri).

Ninguno de estos servicios de terceros recopila datos de identificación personal vinculados a su cuenta a través de nuestra aplicación.

## 3. Permisos de Android
- **Internet (`android.permission.INTERNET`):** Necesario estrictamente para descargar la posición de los satélites en tiempo real y teselas de mapas.
- **Ubicación (Opcional):** Utilizada únicamente bajo su consentimiento expreso al pulsar "Usar mi ubicación" para calcular acimut, elevación y pases de satélites sobre su posición exacta.

## 4. Contacto
Si tiene preguntas o inquietudes sobre esta Política de Privacidad, puede contactarnos a través del repositorio oficial del proyecto.
