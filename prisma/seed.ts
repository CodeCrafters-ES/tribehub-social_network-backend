// prisma/seed.ts
//
// Development seed data for system_configs (feature flags) and interests catalog.
//
// Run with:
//   npx prisma db seed
//
// Key naming convention:
//   feature.<domain>.<flag>  — boolean feature toggles
//   config.<domain>.<param>  — configuration parameters
//
// All upsert calls are idempotent — safe to run multiple times.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const flags = [
    {
      key: 'feature.feed.enabled',
      value: true,
      valueType: 'boolean',
    },
    {
      key: 'feature.search.enabled',
      value: true,
      valueType: 'boolean',
    },
    {
      key: 'feature.reactions.enabled',
      value: true,
      valueType: 'boolean',
    },
    {
      key: 'config.search.rateLimit',
      value: 30,
      valueType: 'number',
    },
  ];

  for (const flag of flags) {
    await prisma.systemConfig.upsert({
      where: { key: flag.key },
      update: { value: flag.value, valueType: flag.valueType },
      create: { key: flag.key, value: flag.value, valueType: flag.valueType },
    });
    console.log(`Seeded: ${flag.key} = ${JSON.stringify(flag.value)}`);
  }

  const interests = [
    // Tech
    { name: 'Programación', slug: 'programacion', category: 'Tech' },
    { name: 'Inteligencia Artificial', slug: 'inteligencia-artificial', category: 'Tech' },
    { name: 'Diseño UX/UI', slug: 'diseno-ux-ui', category: 'Tech' },
    { name: 'Ciberseguridad', slug: 'ciberseguridad', category: 'Tech' },
    { name: 'Blockchain', slug: 'blockchain', category: 'Tech' },
    // Música
    { name: 'Música', slug: 'musica', category: 'Música' },
    { name: 'Producción Musical', slug: 'produccion-musical', category: 'Música' },
    { name: 'Guitarra', slug: 'guitarra', category: 'Música' },
    { name: 'DJ y Electrónica', slug: 'dj-electronica', category: 'Música' },
    // Deportes
    { name: 'Fútbol', slug: 'futbol', category: 'Deportes' },
    { name: 'Running', slug: 'running', category: 'Deportes' },
    { name: 'Yoga', slug: 'yoga', category: 'Deportes' },
    { name: 'Ciclismo', slug: 'ciclismo', category: 'Deportes' },
    { name: 'Natación', slug: 'natacion', category: 'Deportes' },
    { name: 'Escalada', slug: 'escalada', category: 'Deportes' },
    // Arte y Creatividad
    { name: 'Fotografía', slug: 'fotografia', category: 'Arte' },
    { name: 'Ilustración', slug: 'ilustracion', category: 'Arte' },
    { name: 'Pintura', slug: 'pintura', category: 'Arte' },
    { name: 'Diseño Gráfico', slug: 'diseno-grafico', category: 'Arte' },
    { name: 'Escultura', slug: 'escultura', category: 'Arte' },
    // Cultura y Entretenimiento
    { name: 'Cine', slug: 'cine', category: 'Cultura' },
    { name: 'Literatura', slug: 'literatura', category: 'Cultura' },
    { name: 'Podcasts', slug: 'podcasts', category: 'Cultura' },
    { name: 'Anime y Manga', slug: 'anime-manga', category: 'Cultura' },
    { name: 'Videojuegos', slug: 'videojuegos', category: 'Cultura' },
    // Gastronomía
    { name: 'Cocina', slug: 'cocina', category: 'Gastronomía' },
    { name: 'Repostería', slug: 'reposteria', category: 'Gastronomía' },
    { name: 'Vinos y Cata', slug: 'vinos-cata', category: 'Gastronomía' },
    { name: 'Comida Vegana', slug: 'comida-vegana', category: 'Gastronomía' },
    // Viajes y Naturaleza
    { name: 'Viajes', slug: 'viajes', category: 'Viajes' },
    { name: 'Senderismo', slug: 'senderismo', category: 'Viajes' },
    { name: 'Camping', slug: 'camping', category: 'Viajes' },
    { name: 'Buceo', slug: 'buceo', category: 'Viajes' },
    // Ciencia y Educación
    { name: 'Astronomía', slug: 'astronomia', category: 'Ciencia' },
    { name: 'Bienestar y Mindfulness', slug: 'bienestar-mindfulness', category: 'Salud' },
    { name: 'Emprendimiento', slug: 'emprendimiento', category: 'Negocios' },
    { name: 'Finanzas Personales', slug: 'finanzas-personales', category: 'Negocios' },
    { name: 'Idiomas', slug: 'idiomas', category: 'Educación' },
    { name: 'Medio Ambiente', slug: 'medio-ambiente', category: 'Ciencia' },
    { name: 'Moda y Estilo', slug: 'moda-estilo', category: 'Moda' },
  ];

  for (const interest of interests) {
    await prisma.interest.upsert({
      where: { slug: interest.slug },
      update: { name: interest.name, category: interest.category },
      create: interest,
    });
    console.log(`Seeded interest: ${interest.name}`);
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  // IDs fijos para que las relaciones (posts, comments) sean estables entre runs.
  // passwordHash es un placeholder — no válido para login real.
  const SEED_HASH = '$argon2id$v=19$m=65536,t=3,p=4$seed-placeholder$not-a-real-hash';

  const users = [
    { id: '00000001-0000-0000-0000-000000000000', email: 'ana.garcia@tribehub.dev',        username: 'ana_garcia',       passwordHash: SEED_HASH },
    { id: '00000002-0000-0000-0000-000000000000', email: 'carlos.lopez@tribehub.dev',      username: 'carlos_lopez',     passwordHash: SEED_HASH },
    { id: '00000003-0000-0000-0000-000000000000', email: 'maria.rodriguez@tribehub.dev',   username: 'maria_rodriguez',  passwordHash: SEED_HASH },
    { id: '00000004-0000-0000-0000-000000000000', email: 'javier.martinez@tribehub.dev',   username: 'javier_martinez',  passwordHash: SEED_HASH },
    { id: '00000005-0000-0000-0000-000000000000', email: 'laura.sanchez@tribehub.dev',     username: 'laura_sanchez',    passwordHash: SEED_HASH },
    { id: '00000006-0000-0000-0000-000000000000', email: 'pablo.hernandez@tribehub.dev',   username: 'pablo_hernandez',  passwordHash: SEED_HASH },
    { id: '00000007-0000-0000-0000-000000000000', email: 'sofia.gonzalez@tribehub.dev',    username: 'sofia_gonzalez',   passwordHash: SEED_HASH },
    { id: '00000008-0000-0000-0000-000000000000', email: 'diego.fernandez@tribehub.dev',   username: 'diego_fernandez',  passwordHash: SEED_HASH },
    { id: '00000009-0000-0000-0000-000000000000', email: 'isabel.perez@tribehub.dev',      username: 'isabel_perez',     passwordHash: SEED_HASH },
    { id: '00000010-0000-0000-0000-000000000000', email: 'alejandro.torres@tribehub.dev',  username: 'alejandro_torres', passwordHash: SEED_HASH },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { username: user.username },
      create: user,
    });
    console.log(`Seeded user: ${user.username}`);
  }

  // ── Profiles ───────────────────────────────────────────────────────────────
  const profiles = [
    { userId: '00000001-0000-0000-0000-000000000000', displayName: 'Ana García',         bio: 'Desarrolladora frontend apasionada por el diseño accesible.',          avatarUrl: 'https://i.pravatar.cc/150?u=ana' },
    { userId: '00000002-0000-0000-0000-000000000000', displayName: 'Carlos López',        bio: 'Ingeniero de software. Fan del café y del código limpio.',              avatarUrl: 'https://i.pravatar.cc/150?u=carlos' },
    { userId: '00000003-0000-0000-0000-000000000000', displayName: 'María Rodríguez',     bio: 'Fotógrafa y viajera empedernida. Siempre buscando la próxima aventura.', avatarUrl: 'https://i.pravatar.cc/150?u=maria' },
    { userId: '00000004-0000-0000-0000-000000000000', displayName: 'Javier Martínez',     bio: 'Músico y productor. Guitarra, bajo y lo que haga falta.',               avatarUrl: 'https://i.pravatar.cc/150?u=javier' },
    { userId: '00000005-0000-0000-0000-000000000000', displayName: 'Laura Sánchez',       bio: 'Nutricionista y cocinera. Comida real, ingredientes honestos.',          avatarUrl: 'https://i.pravatar.cc/150?u=laura' },
    { userId: '00000006-0000-0000-0000-000000000000', displayName: 'Pablo Hernández',     bio: 'Running y trail. Cada kilómetro es una historia.',                     avatarUrl: 'https://i.pravatar.cc/150?u=pablo' },
    { userId: '00000007-0000-0000-0000-000000000000', displayName: 'Sofía González',      bio: 'Ilustradora y diseñadora gráfica. Creo mundos con papel y pantalla.',   avatarUrl: 'https://i.pravatar.cc/150?u=sofia' },
    { userId: '00000008-0000-0000-0000-000000000000', displayName: 'Diego Fernández',     bio: 'Gamer y streamer. Construyendo comunidad desde el pad.',                avatarUrl: 'https://i.pravatar.cc/150?u=diego' },
    { userId: '00000009-0000-0000-0000-000000000000', displayName: 'Isabel Pérez',        bio: 'Emprendedora. Finanzas personales y libertad financiera.',              avatarUrl: 'https://i.pravatar.cc/150?u=isabel' },
    { userId: '00000010-0000-0000-0000-000000000000', displayName: 'Alejandro Torres',    bio: 'Astrónomo aficionado. El universo cabe en una noche despejada.',        avatarUrl: 'https://i.pravatar.cc/150?u=alejandro' },
  ];

  for (const profile of profiles) {
    await prisma.profile.upsert({
      where: { userId: profile.userId },
      update: { displayName: profile.displayName, bio: profile.bio, avatarUrl: profile.avatarUrl },
      create: profile,
    });
    console.log(`Seeded profile: ${profile.displayName}`);
  }

  // ── Posts ──────────────────────────────────────────────────────────────────
  const posts = [
    {
      id: '00000001-0000-0000-0001-000000000000',
      authorId: '00000001-0000-0000-0000-000000000000',
      content: '¿Alguien más está explorando los nuevos modelos de IA generativa para diseño de interfaces? Estoy probando algunas herramientas y los resultados son sorprendentes. Comparto mis notas esta semana.',
    },
    {
      id: '00000002-0000-0000-0001-000000000000',
      authorId: '00000004-0000-0000-0000-000000000000',
      content: 'Acabo de terminar de grabar la maqueta del nuevo EP. Tres meses de trabajo condensados en 4 canciones. La mezcla empieza la semana que viene. 🎸',
    },
    {
      id: '00000003-0000-0000-0001-000000000000',
      authorId: '00000003-0000-0000-0000-000000000000',
      content: 'Ruta por los Pirineos completada. 120 km en 5 días, 6.000 m de desnivel positivo. La fotografía de montaña tiene algo que no tiene ningún otro género — la luz a 2.500 metros es brutal.',
      imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    },
    {
      id: '00000004-0000-0000-0001-000000000000',
      authorId: '00000005-0000-0000-0000-000000000000',
      content: 'Receta del fin de semana: curry de garbanzos con leche de coco y espinacas. 30 minutos, 5 ingredientes principales y un resultado que no tiene nada que envidiarle a ningún restaurante. ¿Os la comparto?',
    },
    {
      id: '00000005-0000-0000-0001-000000000000',
      authorId: '00000009-0000-0000-0000-000000000000',
      content: 'Tip de finanzas personales que cambió mi perspectiva: antes de invertir en cualquier cosa, calcula cuántas horas de trabajo representa esa cantidad. Cambia completamente cómo valoras el dinero.',
    },
  ];

  for (const post of posts) {
    await prisma.post.upsert({
      where: { id: post.id },
      update: { content: post.content },
      create: post,
    });
    console.log(`Seeded post: ${post.id}`);
  }

  // ── Comments ───────────────────────────────────────────────────────────────
  const comments = [
    { id: '00000001-0000-0000-0002-000000000000', postId: '00000001-0000-0000-0001-000000000000', authorId: '00000002-0000-0000-0000-000000000000', content: 'Cuéntanos qué herramientas estás usando, me pica la curiosidad.' },
    { id: '00000002-0000-0000-0002-000000000000', postId: '00000001-0000-0000-0001-000000000000', authorId: '00000007-0000-0000-0000-000000000000', content: 'Yo también lo estoy explorando desde el lado del diseño gráfico. La generación de componentes visuales es increíble pero hay que saber guiarla.' },
    { id: '00000003-0000-0000-0002-000000000000', postId: '00000002-0000-0000-0001-000000000000', authorId: '00000008-0000-0000-0000-000000000000', content: '¡Qué ganas de escucharlo! ¿Hay algún adelanto por aquí?' },
    { id: '00000004-0000-0000-0002-000000000000', postId: '00000003-0000-0000-0001-000000000000', authorId: '00000006-0000-0000-0000-000000000000', content: 'Brutal ruta, la tengo pendiente desde hace dos años. ¿Qué época del año recomiendas?' },
    { id: '00000005-0000-0000-0002-000000000000', postId: '00000003-0000-0000-0001-000000000000', authorId: '00000010-0000-0000-0000-000000000000', content: 'Las fotos que subes siempre tienen esa luz mágica. ¿Qué hora del día es la mejor según tu experiencia?' },
    { id: '00000006-0000-0000-0002-000000000000', postId: '00000004-0000-0000-0001-000000000000', authorId: '00000003-0000-0000-0000-000000000000', content: '¡Sí, compártela! Los curris veganos son mi debilidad.' },
    { id: '00000007-0000-0000-0002-000000000000', postId: '00000005-0000-0000-0001-000000000000', authorId: '00000002-0000-0000-0000-000000000000', content: 'Este cambio de perspectiva es clave. Tardé años en darme cuenta de que no gastaba dinero, gastaba tiempo de vida.' },
  ];

  for (const comment of comments) {
    await prisma.comment.upsert({
      where: { id: comment.id },
      update: { content: comment.content },
      create: comment,
    });
    console.log(`Seeded comment: ${comment.id}`);
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
