CREATE TABLE "donaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monto" integer NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"origen" text NOT NULL,
	"organizador_id" uuid,
	"mp_preference_id" text NOT NULL,
	"mp_payment_id" text,
	"created_at" timestamp with time zone DEFAULT now()
);
