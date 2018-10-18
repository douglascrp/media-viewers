#!/bin/bash

mvn integration-test -Pamp-to-war,\!enforce-sdk-rules
