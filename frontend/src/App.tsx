import React from "react";
import { Container, Typography, Box } from "@mui/material";
import NominationForm from "./components/NominationForm";

const App: React.FC = () => (
  <Container maxWidth="md">
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 700 }}>
        Helix – Nomination Portal
      </Typography>
      <NominationForm />
    </Box>
  </Container>
);

export default App;
