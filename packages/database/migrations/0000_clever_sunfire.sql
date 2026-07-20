CREATE TABLE "archivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"invitado_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"r2_key" text NOT NULL,
	"thumbnail_key" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizador_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"nombre_evento" text NOT NULL,
	"fecha" date NOT NULL,
	"horario" time NOT NULL,
	"foto_portada_url" text,
	"cantidad_invitados_totales" integer,
	"limite_invitados_login" integer NOT NULL,
	"limite_fotos_por_invitado" integer NOT NULL,
	"limite_videos_por_invitado" integer NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "eventos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "invitados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"apellido" text NOT NULL,
	"telefono" text,
	"acepto_terminos" boolean NOT NULL,
	"token_sesion" text NOT NULL,
	"fotos_subidas" integer DEFAULT 0 NOT NULL,
	"videos_subidos" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "invitados_token_sesion_unique" UNIQUE("token_sesion")
);
--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_invitado_id_invitados_id_fk" FOREIGN KEY ("invitado_id") REFERENCES "public"."invitados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitados" ADD CONSTRAINT "invitados_evento_id_eventos_id_fk" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos"("id") ON DELETE no action ON UPDATE no action;