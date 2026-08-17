import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config({ path: ".env" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase credentials in .env")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function testAgreementsTable() {
  console.log("Checking deal_agreements table...")
  const { data, error } = await supabase.from("deal_agreements").select("id").limit(1)

  if (error) {
    console.log("deal_agreements table query status:", error.message, "(code:", error.code, ")")
  } else {
    console.log("deal_agreements table exists and is accessible!")
  }
}

testAgreementsTable()
