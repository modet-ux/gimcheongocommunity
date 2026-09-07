const { doubleCsrf } = require("csrf-csrf");
const express = require("express");

const csrf = doubleCsrf({
  getSecret: () => {
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
...[truncated]